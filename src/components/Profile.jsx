import {useState,useEffect} from 'react';
const API_BASE = 'http://localhost:3001';

export default function profile(){
    const [user,setUser] = useState(null);
    const[memoryCount, setMemoryCount] = useState(0);

    useEffect(()=>{
        Promise.all([
            fetch(`${API_BASE}/api/get-user`,{credentials: "include"}).then(res => res.json()),
            fetch(`${API_BASE}/api/memories`,{credentials:'include'}).then(res => res.json())
        ]).then(([userData,memoryData])=>{
            if(userData.isLogin)  setUser(UserData.user);
            setMemoryCount(Array.isArray(memoryData) ? memoryData.length :0);
        });
    },[]);

    return (
        <div style={{padding:'40px', maxWidth: '800px', margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:"24px",marginBottom:"40px"}}>
                <div style={{
                    width: '80px',height:'80px',borderRadius:"50%",
                    background:"#48a898", color:"white",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"32px",fontWeight:"bold"
                }}>
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                    <h2 style={{margin:0, color:'#2c4440'}}>{user?.username || "未登录"}</h2>
                    <p style={{margin: '8px 0 0',color:"#688480"}}>已记录 {memoryCount} 条拾光记忆</p>
                </div>
            </div>
            <div style={{dispaly:"grid",gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'20px'}}>
                <div style={{padding:"24px",background:"f0f9f7", borderRadius:'12px'}}>
                    <h3 style={{margin:0, color:"2c4440"}}>我的足迹</h3>
                    <p style={{color:"#688480"}}>地图上的所有记忆点</p>
                </div>
                <div style={{padding:'24px',background:'fff3f0',borderRadius:'12px'}}>
                    <h3 style={{margin:0,color:"#2c4440"}}>我的相册</h3>
                    <p style={{color:'#688480'}}></p>
                </div>
                <div style={{padding:'24px',background:'fffbeb',borderRadius:"12px"}}>
                    <h3 style={{margin:0,color:'#2c4440'}}>我的相册</h3>
                    <p style={{color:"688480"}}>收藏的音乐与片段</p>
                </div>
            </div>
        </div>
    )
}