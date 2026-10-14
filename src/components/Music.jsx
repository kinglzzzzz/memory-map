import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Music.css';

const API_BASE = '';
const themes = ['全部', '城市', '旅行', '治愈', '自然', '其他'];

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

const PlayIcon = ({playing}) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {playing ? <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></> : <path d="m8 5 11 7-11 7V5Z"/>}
  </svg>
);

export default function Music() {
  const audioRef = useRef(null);
  const [tracks, setTracks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [theme, setTheme] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('memory-map-favorite-tracks')) || []; }
    catch { return []; }
  });

  const loadTracks = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/music`, {credentials: 'include'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || '音乐列表加载失败');
    setTracks(data.tracks || []);
    setActiveId((currentId) => data.tracks?.some((track) => track.id === currentId) ? currentId : data.tracks?.[0]?.id || null);
  }, []);

  useEffect(() => {
    loadTracks().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [loadTracks]);

  useEffect(() => {
    localStorage.setItem('memory-map-favorite-tracks', JSON.stringify(favorites));
  }, [favorites]);

  const current = tracks.find((track) => track.id === activeId) || tracks[0] || null;
  const visibleTracks = useMemo(
    () => theme === '全部' ? tracks : tracks.filter((track) => track.theme === theme),
    [theme, tracks],
  );

  const toggleTrack = async (track) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (activeId === track.id && isPlaying) {
      audio.pause();
      return;
    }
    if (activeId !== track.id) {
      setActiveId(track.id);
      setProgress(0);
      setDuration(0);
      audio.src = track.url;
      audio.load();
    }
    try { await audio.play(); }
    catch { setError('音频无法播放，请检查音频文件或网址'); setIsPlaying(false); }
  };

  const playNext = () => {
    if (!tracks.length) return;
    const index = tracks.findIndex((track) => track.id === activeId);
    toggleTrack(tracks[(index + 1) % tracks.length]);
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setProgress(nextTime);
  };

  const toggleFavorite = (id) => {
    setFavorites((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const openEditor = (track = null) => {
    setEditor({
      id: track?.id || null,
      title: track?.title || '',
      artist: track?.artist || '',
      theme: track?.theme || '其他',
      duration: track?.duration || '--:--',
      audioUrl: track?.url?.startsWith('http') ? track.url : '',
    });
    setAudioFile(null);
    setEditorError('');
  };

  const saveTrack = async (event) => {
    event.preventDefault();
    if (!editor.id && !audioFile && !editor.audioUrl.trim()) {
      setEditorError('请上传音频文件或填写音频网址');
      return;
    }
    setSaving(true);
    setEditorError('');
    try {
      const body = new FormData();
      Object.entries(editor).forEach(([key, value]) => key !== 'id' && body.append(key, value));
      if (audioFile) body.append('audio', audioFile);
      const response = await fetch(editor.id ? `${API_BASE}/api/music/${editor.id}` : `${API_BASE}/api/music`, {
        method: editor.id ? 'PUT' : 'POST', credentials: 'include', body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '音乐保存失败');
      await loadTracks();
      setActiveId(data.track.id);
      setEditor(null);
    } catch (saveError) {
      setEditorError(saveError.message || '音乐保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteTrack = async (track) => {
    if (!window.confirm(`确定删除“${track.title}”吗？删除后无法恢复。`)) return;
    try {
      if (activeId === track.id) audioRef.current?.pause();
      const response = await fetch(`${API_BASE}/api/music/${track.id}`, {method: 'DELETE', credentials: 'include'});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '音乐删除失败');
      await loadTracks();
    } catch (deleteError) {
      setError(deleteError.message || '音乐删除失败');
    }
  };

  return (
    <main className="music-page">
      <header className="music-header">
        <div>
          <span className="music-kicker">MEMORY SOUNDTRACK</span>
          <h1>拾光音乐</h1>
          <p>为城市、旅途与安静的片刻，留下一段背景音乐。</p>
        </div>
        <div className="music-header__actions"><button type="button" onClick={() => openEditor()}>＋ 新增音乐</button><div className="music-note" aria-hidden="true">♫</div></div>
      </header>

      {error && <div className="music-alert" role="alert">{error}<button type="button" onClick={() => setError('')}>×</button></div>}
      {loading ? <div className="music-state">正在整理主题歌单…</div> : current ? (
        <>
          <section className="music-player" aria-label="当前播放">
            <div className="music-cover music-cover--large" style={{'--cover-a': current.colors[0], '--cover-b': current.colors[1]}}><span>拾</span><i/><i/><i/></div>
            <div className="music-player__main">
              <span className="music-player__label">正在播放</span><h2>{current.title}</h2><p>{current.artist}</p>
              <div className="music-progress"><span>{formatTime(progress)}</span><input type="range" min="0" max={duration || 100} value={progress} onChange={seek} aria-label="播放进度"/><span>{duration ? formatTime(duration) : current.duration}</span></div>
            </div>
            <button className="music-main-play" type="button" onClick={() => toggleTrack(current)} aria-label={isPlaying ? '暂停' : '播放'}><PlayIcon playing={isPlaying}/></button>
          </section>

          <div className="music-toolbar">
            <div className="music-filters" aria-label="音乐主题筛选">{themes.map((item) => <button type="button" className={theme === item ? 'active' : ''} key={item} onClick={() => setTheme(item)}>{item}</button>)}</div>
            <span>{visibleTracks.length} 首主题音乐</span>
          </div>

          <section className="music-list" aria-label="主题音乐列表">
            {visibleTracks.map((track, index) => {
              const active = activeId === track.id;
              return (
                <article className={`music-track ${active ? 'music-track--active' : ''}`} key={track.id}>
                  <span className="music-track__number">{String(index + 1).padStart(2, '0')}</span>
                  <button className="music-cover music-cover--small" type="button" style={{'--cover-a': track.colors[0], '--cover-b': track.colors[1]}} onClick={() => toggleTrack(track)} aria-label={`${isPlaying && active ? '暂停' : '播放'} ${track.title}`}><span>拾</span><span className="music-cover__play"><PlayIcon playing={isPlaying && active}/></span></button>
                  <div className="music-track__info"><h3>{track.title}</h3><p>{track.artist}</p></div>
                  <span className="music-track__theme">{track.theme}</span><span className="music-track__duration">{track.duration}</span>
                  <button className={`music-favorite ${favorites.includes(track.id) ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(track.id)} aria-label={favorites.includes(track.id) ? '取消收藏' : '收藏'}>{favorites.includes(track.id) ? '♥' : '♡'}</button>
                  <button className="music-row-play" type="button" onClick={() => toggleTrack(track)}><PlayIcon playing={isPlaying && active}/></button>
                  <div className="music-track__manage"><button type="button" onClick={() => openEditor(track)}>编辑</button><button className="danger" type="button" onClick={() => deleteTrack(track)}>删除</button></div>
                </article>
              );
            })}
          </section>
        </>
      ) : <div className="music-state"><strong>歌单还是空的</strong><span>点击“新增音乐”创建第一首主题音乐。</span></div>}

      {editor && (
        <div className="music-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditor(null)}>
          <section className="music-editor" role="dialog" aria-modal="true" aria-labelledby="music-editor-title">
            <div className="music-editor__heading"><div><span>SOUND MEMORY</span><h2 id="music-editor-title">{editor.id ? '编辑主题音乐' : '新增主题音乐'}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></div>
            <form onSubmit={saveTrack}>
              <label><span>音乐标题</span><input required maxLength="120" value={editor.title} onChange={(event) => setEditor((value) => ({...value, title: event.target.value}))}/></label>
              <label><span>创作者 / 场景</span><input maxLength="180" value={editor.artist} onChange={(event) => setEditor((value) => ({...value, artist: event.target.value}))}/></label>
              <div className="music-editor__row"><label><span>主题</span><select value={editor.theme} onChange={(event) => setEditor((value) => ({...value, theme: event.target.value}))}>{themes.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label><span>时长标签</span><input placeholder="03:45" maxLength="20" value={editor.duration} onChange={(event) => setEditor((value) => ({...value, duration: event.target.value}))}/></label></div>
              <label><span>音频网址{editor.id ? '（不修改可留空）' : ''}</span><input type="url" placeholder="https://example.com/music.mp3" value={editor.audioUrl} onChange={(event) => setEditor((value) => ({...value, audioUrl: event.target.value}))}/></label>
              <label><span>{editor.id ? '替换音频文件（可选）' : '或上传音频文件'}</span><input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac" onChange={(event) => setAudioFile(event.target.files?.[0] || null)}/></label>
              {editorError && <p className="music-editor__error" role="alert">{editorError}</p>}
              <div className="music-editor__footer"><button type="button" onClick={() => setEditor(null)}>取消</button><button className="primary" type="submit" disabled={saving}>{saving ? '保存中…' : editor.id ? '保存修改' : '创建音乐'}</button></div>
            </form>
          </section>
        </div>
      )}

      {current && <audio ref={audioRef} src={current.url} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={playNext}/>}
    </main>
  );
}
