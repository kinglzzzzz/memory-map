import {useState} from 'react';
import './Register.css';
export default function Login({ switchToRegister = ()=>{}, onLoginSuccess = ()=>{}}){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({username, password})
        });
        const data = await res.json();
        if(data.success){
            alert('登录成功');
            onLoginSuccess();
        }else{
            alert(data.message || '登录失败');
        }
    }
  

    return (
    <div className="register-page">
      <div className="register-card">
        <h2 className="card-title">登录时光地图</h2>
        <p className="card-desc">查看你的地图足迹、照片与心情记录</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e=>setUsername(e.target.value)}
              placeholder="输入昵称"
              required
            />
          </div>
          <div className="input-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="输入密码"
              required
            />
          </div>
          <button className="register-btn" type="submit">登录</button>
        </form>
        <p className="tip-text">没有账号？<span onClick={() =>{switchToRegister();}} className="link">注册</span></p>
      </div>
    </div>
    );Page
}