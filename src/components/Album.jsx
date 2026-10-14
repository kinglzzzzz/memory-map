import { useCallback, useEffect, useState } from 'react';
import './Album.css';

const API_BASE = '';

const getImageUrl = (photo) => {
  const source = photo.imgSrc?.trim() || '';
  return source.startsWith('http') ? source : `${API_BASE}${source}`;
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

  const closePreview = useCallback(() => setPreviewPhoto(null), []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/memories`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data.filter((item) => item.imgSrc) : [];
        setPhotos(list.sort((a, b) => Number(b.id) - Number(a.id)));
      })
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
  }, [closePreview]);

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
          <div className="album-count"><strong>{photos.length}</strong><span>张拾光照片</span></div>
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
                  <PhotoAsset photo={photo} />
                  <span className="album-card__index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="album-card__view">放大查看</span>
                </button>
                <div className="album-card__content">
                  <div className="album-card__pin">⌖</div>
                  <div>
                    <h2>{photo.title || '未命名的记忆'}</h2>
                    <p>{photo.mood || '这一刻没有留下文字，但照片替你记住了。'}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {previewPhoto && (
        <div className="album-preview" role="dialog" aria-modal="true" aria-label="照片预览" onClick={closePreview}>
          <button className="album-preview__close" type="button" onClick={closePreview} aria-label="关闭预览">×</button>
          <figure onClick={(event) => event.stopPropagation()}>
            <PhotoAsset photo={previewPhoto} preview />
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
