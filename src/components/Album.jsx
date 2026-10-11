import { useState, useEffect, useCallback } from 'react';
const API_BASE = 'http://localhost:3001';

export default function Album() {
  const [photos, setPhotos] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);

  const escClose = useCallback((e) => {
    if (e.key === 'Escape') setPreviewImg(null);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/memories`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data.filter(item => item.imgSrc) : [];
        list.sort((a, b) => b.id - a.id);
        setPhotos(list);
      })
      .catch(err => {
        console.error('相册加载失败', err);
      });

    window.addEventListener('keydown', escClose);
    return () => window.removeEventListener('keydown', escClose);
  }, [escClose]);

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px',
      backgroundImage: `url("/bg-sea.png")`,
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundPosition: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      backgroundBlendMode: 'overlay',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <h2 style={{
        color: '#2c4440',
        marginBottom: '32px',
        fontSize: '28px',
        fontWeight: 600,
        textAlign: 'center'
      }}>拾光相册</h2>

      {photos.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'rgba(255,255,255,0.75)',
          borderRadius: '16px',
          color: '#688480'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
          <h3>相册空空如也</h3>
          <p>去首页地图标记记忆，上传照片吧</p>
        </div>
      ) : (
        <div style={{
          columnCount: 'auto',
          columnWidth: '260px',
          columnGap: '24px',
        }}>
          {photos.map(photo => {
            const rawFileName = photo.imgSrc?.trim() || '';
            const imgUrl = rawFileName.startsWith('http') ? rawFileName : `${API_BASE}${rawFileName}`;
            return (
              <div
                key={photo.id}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  breakInside: 'avoid',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewImg(imgUrl);
                }}
              >
                <img
                  src={imgUrl}
                  alt={photo.title || ''}
                  style={{
                    width: '100%',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.target.src = "https://picsum.photos/id/237/400/300";
                  }}
                />
                <div style={{ padding: '16px' }}>
                  <h4 style={{
                    margin: '0 0 8px 0',
                    color: '#2c4440',
                    fontSize: '18px'
                  }}>{photo.title}</h4>
                  <p style={{
                    margin: 0,
                    color: '#688480',
                    fontSize: '14px',
                    lineHeight: 1.5
                  }}>{photo.mood}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 大图预览弹窗 */}
      {previewImg && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setPreviewImg(null)}>
          <img
            src={previewImg}
            alt="预览大图"
            style={{
              maxWidth: '90%',
              maxHeight: '90vh',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button style={{
            position: 'absolute',
            top: '24px',
            right: '32px',
            fontSize: '32px',
            color: 'white',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }} onClick={(e) => {
            e.stopPropagation();
            setPreviewImg(null);
          }}>×</button>
        </div>
      )}
    </div>
  )
}
