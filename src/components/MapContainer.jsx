import { useState, useRef , useEffect } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; 
import Profile from './Profile';
import Album from './Album';
import Music from './Music';
import Agent from './Agent';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
function MapClickHandler({ onPickPoint }) {
  useMapEvents({
    click(event) {
      onPickPoint({
        lat: event.latlng.lat,
        lng: event.latlng.lng
      })
    }
  })
  return null
}
function MapController({targetPos}) {
  const map = useMap();
  if(targetPos) {
    map.setView([targetPos.lat, targetPos.lng], 10);
  }
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
const API_BASE = 'http://localhost:3001';
export default function MapContainer({onLogout}) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('map')
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [editMemory, setEditMemory] = useState(null)
  const [searchText, setSearchText] = useState('');
  const [mapTargetPos, setMapTargetPos] = useState(null);
  // ✅新增导航页面状态
  const [navPage, setNavPage] = useState('map');

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
  async function searchPlace(){
    if(!searchText.trim()) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${searchText}&format=json`);
    const data = await res.json();
    if(data.length >0){
      const item = data[0];
      setMapTargetPos({lat: Number(item.lat), lng: Number(item.lon)});
    } else{
      alert('未找到该地点');
    }
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

  //导航按钮公共样式
  const navBtnStyle = {
    background:"transparent",
    border:"none",
    color:"#fff",
    fontSize:"16px",
    padding:"8px 12px",
    borderRadius:"4px",
    cursor:"pointer",
    transition:"background 0.2s"
  }

  return (
    <>
      {/* 导航栏 */}
      <div style={{
        width: '100%',
        height:'60px',
        background:"#2c3e50",
        display:"flex",
        alignItems:"center",
        padding:"0 24px",
        boxSizing:"border-box",
        position:"fixed",
        top:0,
        left:0,
        zIndex:999,
        justifyContent:"space-between",
      }}>
        <div style={{display:"flex", alignItems:"center",gap:"32px"}}>
          <div style={{fontSize:"24px", fontWeight:"bold", color:"#fff"}}>拾光记忆</div>
          <div style={{display:"flex",gap:"28px"}}>
            <button style={navBtnStyle} 
              onMouseEnter={(e) => e.target.style.background="#344e59"} 
              onMouseLeave={(e) =>{e.target.style.background="transparent"}}
              onClick={()=>setNavPage('map')}
              >首页</button>
            <button 
              style={navBtnStyle}
              onMouseEnter={(e)=>e.target.style.background="#34495e"}
              onMouseLeave={(e)=>e.target.style.background="transparent"}
              onClick={()=>setNavPage('profile')}
            >个人中心</button>
            <button 
              style={navBtnStyle}
              onMouseEnter={(e)=>e.target.style.background="#34495e"}
              onMouseLeave={(e)=>e.target.style.background="transparent"}
              onClick={()=>setNavPage('album')}
            >拾光相册</button>
            <button 
              style={navBtnStyle}
              onMouseEnter={(e)=>e.target.style.background="#34495e"}
              onMouseLeave={(e)=>e.target.style.background="transparent"}
              onClick={()=>setNavPage('music')}
            >拾光音乐</button>
            <button 
              style={navBtnStyle}
              onMouseEnter={(e)=>e.target.style.background="#34495e"}
              onMouseLeave={(e)=>e.target.style.background="transparent"}
              onClick={()=>setNavPage('agent')}
            >拾光agent</button>
          </div>
        </div>
        <div>
          <button 
            style={{
              background: '#e74c3c',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              cursor: 'pointer',
              padding: '7px 14px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e)=>e.target.style.background="#c0392b"}
            onMouseLeave={(e)=>e.target.style.background="#e74c3c"}
            onClick={()=>{
              if(window.confirm('确定要退出登录吗？')){
                onLogout();
              }
            }}
          >
            退出登录
          </button>
        </div>
      </div>

      {/* 页面内容区域，顶部留空避开导航栏 */}
      <div style={{ marginTop: '60px', height: 'calc(100vh - 60px)' }}>
        {navPage === 'map' && (
          <div className="map-page">
            <h1 className="page-title">拾光记忆</h1>
            <div style={{ display: 'flex', gap: '8px',marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="请输入地点"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => {
                  if(e.key === 'Enter'){
                    searchPlace();
                  }
                }}
              />
              <button onClick={searchPlace} style={{ padding: '8px 16px' }}>
                搜索
              </button>
            </div>
            <div className="map-wrapper">
              <LeafletMap
                center={[23.13, 113.27]}
                zoom={8}
                className="map-container"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController targetPos={mapTargetPos} />
                <MapClickHandler onPickPoint={handlePickPoint} />
                {
                  Array.isArray(memories) && memories.map(memory => (
                    <Marker key={memory.id} position={[memory.lat, memory.lng]}>
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
                  <Marker key="selected-point" position={[selectedPoint.lat, selectedPoint.lng]}>
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
        {navPage === 'profile' && <div style={{padding:20}}><Profile /></div>}
        {navPage === 'album' && <div style={{padding:20}}><Album /></div>}
        {navPage === 'music' && <div style={{padding:20}}><Music/></div>}
        {navPage === 'agent' && <div style={{padding:20}}><Agent/></div>}
      </div>
    </>
  )
}
