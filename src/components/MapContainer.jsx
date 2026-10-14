import { useState, useRef , useEffect } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMapEvents, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; 
import Profile from './Profile';
import Album from './Album';
import Music from './Music';
import Agent from './Agent';
import AdminPanel from './AdminPanel';
import './MapContainer.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const dollCharacters = ['🐻', '🐰', '🐼', '🐱'];
const dollIcons = dollCharacters.map((character, index) => L.divIcon({
  className: 'memory-doll-icon',
  html: `<div class="memory-doll memory-doll--${index}"><span>${character}</span><i></i></div>`,
  iconSize: [52, 62],
  iconAnchor: [26, 58],
  popupAnchor: [0, -55],
}));

const getDollIcon = (id) => dollIcons[Math.abs(Number(id) || 0) % dollIcons.length];

const searchResultIcon = L.divIcon({
  className: 'memory-doll-icon',
  html: '<div class="memory-doll memory-doll--search"><span>🦊</span><b>⌖</b><i></i></div>',
  iconSize: [56, 66],
  iconAnchor: [28, 62],
  popupAnchor: [0, -59],
});

const newMemoryIcon = L.divIcon({
  className: 'memory-doll-icon',
  html: '<div class="memory-doll memory-doll--new"><span>🐣</span><b>＋</b><i></i></div>',
  iconSize: [54, 64],
  iconAnchor: [27, 60],
  popupAnchor: [0, -57],
});

const coordinatePi = Math.PI;
const transformLat = (lng, lat) => {
  let result = -100 + 2 * lng + 3 * lat + .2 * lat * lat + .1 * lng * lat + .2 * Math.sqrt(Math.abs(lng));
  result += (20 * Math.sin(6 * lng * coordinatePi) + 20 * Math.sin(2 * lng * coordinatePi)) * 2 / 3;
  result += (20 * Math.sin(lat * coordinatePi) + 40 * Math.sin(lat / 3 * coordinatePi)) * 2 / 3;
  return result + (160 * Math.sin(lat / 12 * coordinatePi) + 320 * Math.sin(lat * coordinatePi / 30)) * 2 / 3;
};
const transformLng = (lng, lat) => {
  let result = 300 + lng + 2 * lat + .1 * lng * lng + .1 * lng * lat + .1 * Math.sqrt(Math.abs(lng));
  result += (20 * Math.sin(6 * lng * coordinatePi) + 20 * Math.sin(2 * lng * coordinatePi)) * 2 / 3;
  result += (20 * Math.sin(lng * coordinatePi) + 40 * Math.sin(lng / 3 * coordinatePi)) * 2 / 3;
  return result + (150 * Math.sin(lng / 12 * coordinatePi) + 300 * Math.sin(lng / 30 * coordinatePi)) * 2 / 3;
};
const outsideChina = (lat, lng) => lng < 72.004 || lng > 137.8347 || lat < .8293 || lat > 55.8271;
const wgs84ToGcj02 = (lat, lng) => {
  if (outsideChina(lat, lng)) return [lat, lng];
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * coordinatePi;
  let magic = Math.sin(radLat);
  magic = 1 - .006693421622965943 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = dLat * 180 / ((6335552.717000426 / (magic * sqrtMagic)) * coordinatePi);
  dLng = dLng * 180 / ((6378245 / sqrtMagic * Math.cos(radLat)) * coordinatePi);
  return [lat + dLat, lng + dLng];
};
const gcj02ToWgs84 = (lat, lng) => {
  const [convertedLat, convertedLng] = wgs84ToGcj02(lat, lng);
  return [lat * 2 - convertedLat, lng * 2 - convertedLng];
};

const tileProviders = [
  {
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图'
  },
  {
    url: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; GeoQ'
  }
];

function ResilientTileLayer() {
  const [providerIndex, setProviderIndex] = useState(0);
  const errorCount = useRef(0);
  const provider = tileProviders[providerIndex];
  return (
    <TileLayer
      key={provider.url}
      url={provider.url}
      subdomains={provider.subdomains}
      attribution={provider.attribution}
      maxZoom={18}
      crossOrigin
      eventHandlers={{
        tileerror: () => {
          errorCount.current += 1;
          if (errorCount.current >= 3 && providerIndex < tileProviders.length - 1) {
            errorCount.current = 0;
            setProviderIndex((current) => current + 1);
          }
        }
      }}
    />
  );
}

function MapClickHandler({ onPickPoint }) {
  useMapEvents({
    click(event) {
      const [lat, lng] = gcj02ToWgs84(event.latlng.lat, event.latlng.lng);
      onPickPoint({
        lat,
        lng
      })
    }
  })
  return null
}
function MapController({targetPos}) {
  const map = useMap();
  useEffect(() => {
    const refreshSize = () => map.invalidateSize({ pan: false });
    const frame = window.requestAnimationFrame(refreshSize);
    window.addEventListener('resize', refreshSize);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(refreshSize);
    observer?.observe(map.getContainer());

    if(targetPos) {
      map.flyTo(wgs84ToGcj02(targetPos.lat, targetPos.lng), targetPos.zoom || 15, { duration: 1.25 });
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', refreshSize);
      observer?.disconnect();
    };
  }, [map, targetPos]);
  return null;
}
function MemoryDetail({memory, onSave, onBack, onDelete, fetchMemories}){
  const fileRef =useRef(null);
  const [title, setTitle] = useState(memory?.title || "");
  const [mood, setMood] = useState(memory?.mood || "");
  const [imgFile, setImgFile] = useState(null);
  const [imgSrc, setImgSrc] = useState(memory?.imgSrc || "");
  function handleFileChange(e){
    const file = e.target.files[0];
    if(!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = (ev) =>{
      setImgSrc(ev.target.result);
    }
    reader.readAsDataURL(file);
  }
  const submitSave= async () => {
    const formData = new FormData();
    formData.append('lat', memory.lat);
    formData.append('lng', memory.lng);
    formData.append('title', title);
    formData.append('mood', mood);
    if(imgFile){
      formData.append('file', imgFile);
    }
    let resp;
    if(memory.id && !Number.isNaN(Number(memory.id)) && memory.id < 9999999999){
      resp = await fetch(`${API_BASE}/api/memories/${memory.id}`, {
        credentials: 'include',
        method: 'PUT',
        body: formData
      });
    } else {
      resp = await fetch(`${API_BASE}/api/memories`, {
        credentials: 'include',
        method: 'POST',
        body: formData
      })
    }
    const json = await resp.json();
    if(json.success){
      await fetchMemories();
      onBack();
    }else{
      alert(json.error||'保存失败');
    }
  };  
  return (
    <div className="memory-detail">
      <div className="detail-card">
        <h2>记录美好时光 </h2>
        <div className="coord-info">
         坐标 : {Number(memory.lat).toFixed(3)}, {Number(memory.lng).toFixed(3)}
        </div>
        <div className="form-item">
          <label>标题</label>
          <input
            type="text"
            placeholder="广州一日游"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div className="form-item">
          <label>当时的心情</label>
          <textarea
            placeholder="写下此刻感受"
            value={mood}
            onChange={e => setMood(e.target.value)}
          ></textarea>
        </div>
        <div className="form-item">
          <label>上传图片</label>
          <input
            type="file"
            ref={fileRef}
            onChange={handleFileChange}
            accept="image/*"
          />
          {imgSrc && <img className="preview-image" src={imgSrc} alt="图片预览" />}
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={submitSave}>
            保存记忆
          </button>
          <button className="btn btn-secondary" onClick={onBack}>
            返回地图
          </button>
          <button className="btn btn-danger" onClick={() => onDelete(memory.id)}>
            删除记忆
          </button>
        </div>
      </div>
    </div>
  );
}
const API_BASE = '';
export default function MapContainer({onLogout, user, initialPage = 'map'}) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('map')
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [editMemory, setEditMemory] = useState(null)
  const [searchText, setSearchText] = useState('');
  const [mapTargetPos, setMapTargetPos] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [navPage, setNavPage] = useState(initialPage);
  const [adminSection, setAdminSection] = useState('overview');

  const fetchMemories = async() =>{
    setLoading(true);
    try{
      const res= await fetch(`${API_BASE}/api/memories`, {credentials: 'include'});
      if(!res.ok){
        throw new Error(`服务器错误：${res.status}`);
      }
      const data= await res.json();
      setMemories(data);
    }catch(e){
      alert('请求数据失败');
      console.error(e);
    }finally{
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchMemories();
  }, []);

  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2 || mapTargetPos?.shortName === query) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({q: query});
        const response = await fetch(`${API_BASE}/api/geocode?${params}`, {
          credentials: 'include',
          signal: controller.signal
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || '地点服务暂时不可用');
        }
        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
        if (!data.length) setSearchError('没有找到匹配地点，请补充城市或区县名称');
      } catch (error) {
        if (error.name !== 'AbortError') setSearchError(error.message || '搜索失败，请稍后重试');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 420);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, mapTargetPos?.shortName]);
  function handlePickPoint(point) {
    setSelectedPoint(point)
  }
  function openNewMemory() {
    setEditMemory({
      id: Date.now(),
      lat: selectedPoint.lat,
      lng: selectedPoint.lng,
      title: "",
      mood: "",
      imgSrc: null
    });
    setViewMode('detail');
  }
  function openExistMemory(item) {
    setEditMemory(item);
    setViewMode('detail');
  }
  async function saveMemory(data) {
    try{
      const existIndex = memories.findIndex(m => m.id === data.id);
      if (existIndex >= 0) {
        const res = await fetch(`${API_BASE}/api/memories/${data.id}`, {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        await res.json();
        const updatedMemories = [...memories];
        updatedMemories[existIndex] = data;
        setMemories(updatedMemories);
      } else {
        const res = await fetch(`${API_BASE}/api/memories`, {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        data.id = result.id;
        setMemories([...memories, data]);
      }
      setViewMode('map');
      setSelectedPoint(null);
    }catch(e){
      alert('保存数据失败');
      console.error(e);
    }
  }
  
  async function deleteMemory(id) {
    try{
      await fetch(`${API_BASE}/api/memories/${id}`, {
        credentials: 'include',
        method: 'DELETE'
      });
      const updatedMemories = memories.filter(m => m.id !== id);
      setMemories(updatedMemories);
      backToMap();
    }catch(e){
      alert('删除数据失败');
      console.error(e);
    }
  }
  function backToMap() {
    setViewMode('map');
    setEditMemory(null);
  }
  function selectSearchResult(item){
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    const label = item.display_name || searchText;
    setMapTargetPos({
      lat,
      lng,
      label,
      shortName: item.name || label.split(',')[0],
      type: item.type,
      zoom: ['city', 'administrative'].includes(item.type) ? 12 : 16,
    });
    setSearchText(item.name || label.split(',')[0]);
    setShowSuggestions(false);
    setSearchError('');
  }

  async function searchPlace(){
    if(!searchText.trim()) return;
    if (searchResults.length > 0) {
      selectSearchResult(searchResults[0]);
      return;
    }
    setSearchError('请从联想结果中选择准确地点');
  }
  
  if(viewMode === 'detail'){
    return (
      <MemoryDetail
        memory={editMemory}
        onSave={saveMemory}
        onBack={backToMap}
        onDelete={deleteMemory}
        fetchMemories={fetchMemories}
      />
    )
  }
  if(loading) return <div>加载记忆数据...</div>;

  return (
    <>
      <nav className={`app-navbar ${user?.role === 'super_admin' ? 'app-navbar--admin' : ''}`} aria-label={user?.role === 'super_admin' ? '超级管理员导航' : '主导航'}>
        <div className="app-navbar__main">
          <div className="app-navbar__brand">{user?.role === 'super_admin' ? <>拾光管理台 <small>ADMIN</small></> : '拾光记忆'}</div>
          <div className="app-navbar__links">
            {user?.role === 'super_admin' ? <>
              <button className={navPage === 'admin' && adminSection === 'overview' ? 'active' : ''} onClick={() => { setAdminSection('overview'); setNavPage('admin'); }}>数据总览</button>
              <button className={navPage === 'admin' && adminSection === 'users' ? 'active' : ''} onClick={() => { setAdminSection('users'); setNavPage('admin'); }}>用户管理</button>
              <button className={navPage === 'admin' && adminSection === 'content' ? 'active' : ''} onClick={() => { setAdminSection('content'); setNavPage('admin'); }}>内容数据库</button>
              <button className={navPage === 'admin' && adminSection === 'events' ? 'active' : ''} onClick={() => { setAdminSection('events'); setNavPage('admin'); }}>安全审计</button>
              <button className={navPage === 'map' ? 'active' : ''} onClick={()=>setNavPage('map')}>用户端地图</button>
              <button className={navPage === 'profile' ? 'active' : ''} onClick={()=>setNavPage('profile')}>管理员档案</button>
            </> : <>
              <button className={navPage === 'map' ? 'active' : ''} onClick={()=>setNavPage('map')}>首页</button>
              <button className={navPage === 'album' ? 'active' : ''} onClick={()=>setNavPage('album')}>拾光相册</button>
              <button className={navPage === 'music' ? 'active' : ''} onClick={()=>setNavPage('music')}>拾光音乐</button>
              <button className={navPage === 'agent' ? 'active' : ''} onClick={()=>setNavPage('agent')}>拾光 Agent</button>
              <button className={navPage === 'profile' ? 'active' : ''} onClick={()=>setNavPage('profile')}>拾光档案</button>
            </>}
          </div>
        </div>
          <button className="app-navbar__logout"
            onClick={()=>{
              if(window.confirm('确定要退出登录吗？')){
                onLogout();
              }
            }}
          >
            <span className="app-navbar__logout-wide">退出登录</span><span className="app-navbar__logout-short">退出</span>
          </button>
      </nav>

      <div className="app-content">
        {navPage === 'map' && (
          <div className="map-page">
            <header className="map-hero">
              <div>
                <span className="map-kicker">MEMORY ATLAS</span>
                <h1>从一个地点，打开一段记忆</h1>
                <p>搜索城市、街道或地标，地图会带你准确抵达。</p>
              </div>
              <div className="map-memory-count"><strong>{memories.length}</strong><span>个记忆坐标</span></div>
            </header>

            <div className="place-search">
              <div className="place-search__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              </div>
              <input
                type="search"
                placeholder="搜索地点，例如：广州塔、杭州西湖、北京故宫"
                value={searchText}
                onChange={e => {
                  const value = e.target.value;
                  setSearchText(value);
                  if (value.trim().length < 2) setSearchResults([]);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => {
                  if(e.key === 'Enter') searchPlace();
                  if(e.key === 'Escape') setShowSuggestions(false);
                }}
                aria-label="搜索地点"
                aria-expanded={showSuggestions && searchResults.length > 0}
              />
              {searching && <span className="place-search__loading" aria-label="正在搜索" />}
              <button onClick={searchPlace} type="button">定位地点</button>

              {showSuggestions && (searchResults.length > 0 || searchError) && (
                <div className="place-suggestions">
                  {searchError && searchResults.length === 0 ? (
                    <p className="place-suggestions__empty">{searchError}</p>
                  ) : searchResults.map((item) => (
                    <button type="button" key={item.place_id} onClick={() => selectSearchResult(item)}>
                      <span className="place-suggestions__pin">⌖</span>
                      <span><strong>{item.name || item.display_name.split(',')[0]}</strong><small>{item.display_name}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mapTargetPos && (
              <div className="located-place" role="status">
                <span className="located-place__pulse" />
                <div><strong>已定位：{mapTargetPos.shortName}</strong><span>{mapTargetPos.label}</span></div>
                <code>{mapTargetPos.lat.toFixed(5)}, {mapTargetPos.lng.toFixed(5)}</code>
                <button type="button" onClick={() => { setMapTargetPos(null); setSearchText(''); }}>清除</button>
              </div>
            )}
            <div className="map-wrapper">
              <LeafletMap
                center={wgs84ToGcj02(23.13, 113.27)}
                zoom={8}
                className="map-container"
                zoomControl={false}
              >
                <ResilientTileLayer />
                <ZoomControl position="bottomright" />
                <MapController targetPos={mapTargetPos} />
                <MapClickHandler onPickPoint={handlePickPoint} />
                {mapTargetPos && (
                  <Marker position={wgs84ToGcj02(mapTargetPos.lat, mapTargetPos.lng)} icon={searchResultIcon} zIndexOffset={1000}>
                    <Popup className="search-popup">
                      <strong>{mapTargetPos.shortName}</strong>
                      <p>{mapTargetPos.label}</p>
                      <span>{mapTargetPos.lat.toFixed(5)}, {mapTargetPos.lng.toFixed(5)}</span>
                    </Popup>
                  </Marker>
                )}
                {
                  Array.isArray(memories) && memories.map(memory => (
                    <Marker key={memory.id} position={wgs84ToGcj02(Number(memory.lat), Number(memory.lng))} icon={getDollIcon(memory.id)}>
                      <Popup>
                        <h3 className="popup-title">{memory.title}</h3>
                        <p className="popup-story">{memory.mood || "暂无心情描述"}</p>
                        <button className="btn btn-primary" onClick={() => openExistMemory(memory)}>
                          查看详情
                        </button>
                      </Popup>
                    </Marker>
                  ))
                }
                {selectedPoint && (
                  <Marker key="selected-point" position={wgs84ToGcj02(selectedPoint.lat, selectedPoint.lng)} icon={newMemoryIcon}>
                    <Popup>
                      <p className="selected-coord">
                        选中坐标：{Number(selectedPoint.lat).toFixed(3)}, {Number(selectedPoint.lng).toFixed(3)}
                      </p>
                      <button className="btn btn-primary" onClick={openNewMemory}>
                        新建记忆
                      </button>
                    </Popup>
                  </Marker>
                )}
              </LeafletMap>
            </div>
          </div>
        )}
        {navPage === 'profile' && <Profile onNavigate={setNavPage} onLogout={onLogout} />}
        {navPage === 'album' && <Album />}
        {navPage === 'music' && <Music />}
        {navPage === 'agent' && <Agent memories={memories} />}
        {navPage === 'admin' && user?.role === 'super_admin' && <AdminPanel section={adminSection} onSectionChange={setAdminSection} />}
      </div>
    </>
  )
}
