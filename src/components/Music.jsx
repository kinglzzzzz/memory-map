import { useEffect, useMemo, useRef, useState } from 'react';
import './Music.css';

const tracks = [
  { id: 1, title: '城市晚风', artist: 'SoundHelix · 夜行片段', theme: '城市', duration: '06:12', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', colors: ['#425b70', '#e5a15d'] },
  { id: 2, title: '沿海公路', artist: 'SoundHelix · 旅途声景', theme: '旅行', duration: '05:31', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', colors: ['#3e8b91', '#eed59d'] },
  { id: 3, title: '雨停以后', artist: 'SoundHelix · 安静时刻', theme: '治愈', duration: '05:03', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', colors: ['#687c98', '#d8d3e8'] },
  { id: 4, title: '山野来信', artist: 'SoundHelix · 自然漫游', theme: '自然', duration: '04:46', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', colors: ['#4b7966', '#d4b77d'] },
  { id: 5, title: '午后留白', artist: 'SoundHelix · 咖啡时间', theme: '治愈', duration: '05:24', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', colors: ['#8a6656', '#e8c99d'] },
  { id: 6, title: '星空慢行', artist: 'SoundHelix · 深夜收藏', theme: '城市', duration: '05:15', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', colors: ['#363c69', '#b88bb8'] },
];

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

const PlayIcon = ({ playing }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {playing ? <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></> : <path d="m8 5 11 7-11 7V5Z"/>}
  </svg>
);

export default function Music() {
  const audioRef = useRef(null);
  const [activeId, setActiveId] = useState(tracks[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [theme, setTheme] = useState('全部');
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('memory-map-favorite-tracks')) || []; }
    catch { return []; }
  });

  const current = tracks.find((track) => track.id === activeId) || tracks[0];
  const visibleTracks = useMemo(
    () => theme === '全部' ? tracks : tracks.filter((track) => track.theme === theme),
    [theme],
  );

  useEffect(() => {
    localStorage.setItem('memory-map-favorite-tracks', JSON.stringify(favorites));
  }, [favorites]);

  const toggleTrack = async (track) => {
    const audio = audioRef.current;
    if (!audio) return;

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
    catch { setIsPlaying(false); }
  };

  const playNext = () => {
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

  return (
    <main className="music-page">
      <header className="music-header">
        <div>
          <span className="music-kicker">MEMORY SOUNDTRACK</span>
          <h1>拾光音乐</h1>
          <p>为城市、旅途与安静的片刻，留下一段背景音乐。</p>
        </div>
        <div className="music-note" aria-hidden="true">♫</div>
      </header>

      <section className="music-player" aria-label="当前播放">
        <div className="music-cover music-cover--large" style={{ '--cover-a': current.colors[0], '--cover-b': current.colors[1] }}>
          <span>拾</span><i /><i /><i />
        </div>
        <div className="music-player__main">
          <span className="music-player__label">正在播放</span>
          <h2>{current.title}</h2>
          <p>{current.artist}</p>
          <div className="music-progress">
            <span>{formatTime(progress)}</span>
            <input type="range" min="0" max={duration || 100} value={progress} onChange={seek} aria-label="播放进度" />
            <span>{duration ? formatTime(duration) : current.duration}</span>
          </div>
        </div>
        <button className="music-main-play" type="button" onClick={() => toggleTrack(current)} aria-label={isPlaying ? '暂停' : '播放'}>
          <PlayIcon playing={isPlaying} />
        </button>
      </section>

      <div className="music-toolbar">
        <div className="music-filters" aria-label="音乐主题筛选">
          {['全部', '城市', '旅行', '治愈', '自然'].map((item) => (
            <button type="button" className={theme === item ? 'active' : ''} key={item} onClick={() => setTheme(item)}>{item}</button>
          ))}
        </div>
        <span>{visibleTracks.length} 首主题音乐</span>
      </div>

      <section className="music-list" aria-label="主题音乐列表">
        {visibleTracks.map((track, index) => {
          const active = activeId === track.id;
          return (
            <article className={`music-track ${active ? 'music-track--active' : ''}`} key={track.id}>
              <span className="music-track__number">{String(index + 1).padStart(2, '0')}</span>
              <button className="music-cover music-cover--small" type="button" style={{ '--cover-a': track.colors[0], '--cover-b': track.colors[1] }} onClick={() => toggleTrack(track)} aria-label={`${isPlaying && active ? '暂停' : '播放'} ${track.title}`}>
                <span>拾</span>
                <span className="music-cover__play"><PlayIcon playing={isPlaying && active} /></span>
              </button>
              <div className="music-track__info">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
              <span className="music-track__theme">{track.theme}</span>
              <span className="music-track__duration">{track.duration}</span>
              <button className={`music-favorite ${favorites.includes(track.id) ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(track.id)} aria-label={favorites.includes(track.id) ? '取消收藏' : '收藏'}>
                {favorites.includes(track.id) ? '♥' : '♡'}
              </button>
              <button className="music-row-play" type="button" onClick={() => toggleTrack(track)}><PlayIcon playing={isPlaying && active} /></button>
            </article>
          );
        })}
      </section>

      <p className="music-credit">音频资源来自 SoundHelix 公共示例库，仅用于本项目功能演示。</p>
      <audio
        ref={audioRef}
        src={current.url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={playNext}
      />
    </main>
  );
}
