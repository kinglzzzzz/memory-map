import { useCallback, useEffect, useState } from 'react';
import './Album.css';

const API_BASE = '';

const getImageUrl = (photo) => {
  const source = photo.imgSrc?.trim() || '';
  return source.startsWith('http') ? source : `${API_BASE}${source}`;
};

const moodEmojiRules = [
  [/国庆|庆祝|节日|兴奋|激动/, '🎉'],
  [/晚霞|夕阳|黄昏|日落/, '🌇'],
  [/开心|快乐|高兴|愉快|幸福|美好/, '😊'],
  [/惊喜|震撼|期待/, '🤩'],
  [/浪漫|喜欢|爱|甜蜜/, '💕'],
  [/平静|宁静|放松|治愈|惬意/, '😌'],
  [/思念|想念|不舍/, '🥺'],
  [/难过|伤心|失落|哭/, '😢'],
  [/生气|愤怒/, '😠'],
  [/疲惫|困|累/, '😴'],
  [/美食|好吃|餐厅|咖啡/, '😋'],
  [/大海|海边|沙滩|海浪/, '🌊'],
  [/下雨|雨天/, '🌧️'],
  [/下雪|雪天/, '❄️'],
  [/登山|山顶|爬山/, '⛰️'],
  [/旅行|出发|旅途/, '🧳']
];

const getMoodEmoji = (mood) => {
  const text = String(mood || '').trim();
  const writtenEmoji = text.match(/(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic})(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u)?.[0];
  if (writtenEmoji) return writtenEmoji;
  return moodEmojiRules.find(([pattern]) => pattern.test(text))?.[1] || '🌿';
};

function PhotoAsset({photo, preview = false}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`album-photo-missing${preview ? ' album-photo-missing--preview' : ''}`}>
        <span aria-hidden="true">⌁</span>
        <strong>照片文件暂不可用</strong>
        <small>请重新上传，或检查 Railway 持久化存储</small>
      </span>
    );
  }
  return (
    <img
      src={getImageUrl(photo)}
      alt={photo.title || '记忆照片'}
      loading={preview ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}

export default function Album() {
  const [photos, setPhotos] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [editorFile, setEditorFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');

  const closePreview = useCallback(() => setPreviewPhoto(null), []);
  const loadPhotos = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/memories`, {credentials: 'include'});
    if (!response.ok) throw new Error('相册加载失败');
    const data = await response.json();
    const list = Array.isArray(data) ? data.filter((item) => item.imgSrc) : [];
    setPhotos(list.sort((a, b) => Number(b.id) - Number(a.id)));
  }, []);

  useEffect(() => {
    let active = true;
    loadPhotos()
      .catch((error) => console.error('相册加载失败', error))
      .finally(() => active && setLoading(false));

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, loadPhotos]);

  const openEditor = (photo = null) => {
    setEditor({
      id: photo?.id || null,
      title: photo?.title || '',
      mood: photo?.mood || '',
      lat: String(photo?.lat ?? 23.1291),
      lng: String(photo?.lng ?? 113.2644),
      imgSrc: photo?.imgSrc || '',
    });
    setEditorFile(null);
    setEditorError('');
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setEditorError('当前浏览器不支持定位');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({coords}) => setEditor((current) => ({...current, lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6)})),
      () => setEditorError('无法获取当前位置，请检查浏览器定位权限'),
      {enableHighAccuracy: true, timeout: 10000},
    );
  };

  const savePhoto = async (event) => {
    event.preventDefault();
    if (!editor.id && !editorFile) {
      setEditorError('新增照片时请选择图片');
      return;
    }
    setSaving(true);
    setEditorError('');
    try {
      const body = new FormData();
      body.append('title', editor.title.trim());
      body.append('mood', editor.mood.trim());
      body.append('lat', editor.lat);
      body.append('lng', editor.lng);
      if (editorFile) body.append('file', editorFile);
      const response = await fetch(editor.id ? `${API_BASE}/api/memories/${editor.id}` : `${API_BASE}/api/memories`, {
        method: editor.id ? 'PUT' : 'POST',
        credentials: 'include',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || '照片保存失败');
      await loadPhotos();
      setEditor(null);
    } catch (error) {
      setEditorError(error.message || '照片保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (!window.confirm(`确定删除“${photo.title || '未命名照片'}”吗？删除后无法恢复。`)) return;
    try {
      const response = await fetch(`${API_BASE}/api/memories/${photo.id}`, {method: 'DELETE', credentials: 'include'});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '删除失败');
      setPreviewPhoto((current) => current?.id === photo.id ? null : current);
      await loadPhotos();
    } catch (error) {
      window.alert(error.message || '删除失败');
    }
  };

  return (
    <main className="album-page">
      <div className="album-backdrop" aria-hidden="true" />
      <div className="album-shell">
        <header className="album-header">
          <div>
            <span className="album-kicker">MOMENTS IN FRAME</span>
            <h1>拾光相册</h1>
            <p>把走过的地方，收藏成可以反复翻阅的风景。</p>
          </div>
          <div className="album-header__actions">
            <div className="album-count"><strong>{photos.length}</strong><span>张拾光照片</span></div>
            <button className="album-add" type="button" onClick={() => openEditor()}>＋ 新增照片</button>
          </div>
        </header>

        {loading ? (
          <div className="album-loading"><span />正在冲洗记忆照片…</div>
        ) : photos.length === 0 ? (
          <section className="album-empty">
            <div>▧</div>
            <h2>相册还是空的</h2>
            <p>回到首页，在地图上标记一段记忆并上传照片吧。</p>
          </section>
        ) : (
          <section className="album-grid" aria-label="记忆照片">
            {photos.map((photo, index) => (
              <article className="album-card" key={photo.id} style={{ '--card-delay': `${index * 60}ms` }}>
                <button className="album-card__image" type="button" onClick={() => setPreviewPhoto(photo)} aria-label={`查看照片：${photo.title || '未命名记忆'}`}>
                  <PhotoAsset key={photo.imgSrc} photo={photo} />
                  <span className="album-card__index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="album-card__view">放大查看</span>
                </button>
                <div className="album-card__content">
                  <div className="album-card__pin" role="img" aria-label={`心情：${photo.mood || '平静'}`} title={photo.mood || '平静'}>
                    {getMoodEmoji(photo.mood)}
                  </div>
                  <div>
                    <h2>{photo.title || '未命名的记忆'}</h2>
                    <p>{photo.mood || '这一刻没有留下文字，但照片替你记住了。'}</p>
                    <div className="album-card__actions">
                      <button type="button" onClick={() => openEditor(photo)}>编辑</button>
                      <button className="danger" type="button" onClick={() => deletePhoto(photo)}>删除</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {editor && (
        <div className="album-editor-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditor(null)}>
          <section className="album-editor" role="dialog" aria-modal="true" aria-labelledby="album-editor-title">
            <div className="album-editor__heading">
              <div><span>PHOTO MEMORY</span><h2 id="album-editor-title">{editor.id ? '编辑拾光照片' : '新增拾光照片'}</h2></div>
              <button type="button" aria-label="关闭编辑窗口" disabled={saving} onClick={() => setEditor(null)}>×</button>
            </div>
            <form onSubmit={savePhoto}>
              <label><span>照片标题</span><input value={editor.title} maxLength="100" required placeholder="给这段记忆起个名字" onChange={(event) => setEditor((current) => ({...current, title: event.target.value}))} /></label>
              <label><span>心情故事</span><textarea value={editor.mood} maxLength="1000" placeholder="写下当时的心情，支持添加 Emoji" onChange={(event) => setEditor((current) => ({...current, mood: event.target.value}))} /></label>
              <label><span>{editor.id ? '替换图片（可选）' : '选择图片'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!editor.id} onChange={(event) => setEditorFile(event.target.files?.[0] || null)} /></label>
              <div className="album-editor__coordinates">
                <label><span>纬度</span><input type="number" step="any" min="-90" max="90" required value={editor.lat} onChange={(event) => setEditor((current) => ({...current, lat: event.target.value}))} /></label>
                <label><span>经度</span><input type="number" step="any" min="-180" max="180" required value={editor.lng} onChange={(event) => setEditor((current) => ({...current, lng: event.target.value}))} /></label>
                <button type="button" onClick={useCurrentLocation}>使用当前位置</button>
              </div>
              {editorError && <p className="album-editor__error" role="alert">{editorError}</p>}
              <div className="album-editor__footer">
                <button type="button" disabled={saving} onClick={() => setEditor(null)}>取消</button>
                <button className="primary" type="submit" disabled={saving}>{saving ? '保存中…' : editor.id ? '保存修改' : '创建照片'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {previewPhoto && (
        <div className="album-preview" role="dialog" aria-modal="true" aria-label="照片预览" onClick={closePreview}>
          <button className="album-preview__close" type="button" onClick={closePreview} aria-label="关闭预览">×</button>
          <figure onClick={(event) => event.stopPropagation()}>
            <PhotoAsset key={previewPhoto.imgSrc} photo={previewPhoto} preview />
            <figcaption>
              <strong>{previewPhoto.title || '未命名的记忆'}</strong>
              {previewPhoto.mood && <span>{previewPhoto.mood}</span>}
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}
