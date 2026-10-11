import {useState} from 'react';
import './Register.css';

export default function Register({switchToLogin = ()=>{}}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res= await fetch('http://localhost:3001/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            cendentials: 'include',
            body: JSON.stringify({username,password}),
        });
        const data = await res.json();
        if(data.success){
            alert('注册成功,请登录');
            switchToLogin();
        }else{
            alert(data.message || '注册失败');
        }
    };

    return (
        <div className="register-page">
        <div className="register-card">
            <h2 className="card-title">创建时光账号</h2>
            <p className="card-desc">保存地图足迹，记录旅途心情与照片</p>
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label>用户名</label>
                    <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    palceholder="请输入用户名"
                    required
                    />
                </div>
                <div className="input-group">
                    <label>密码</label>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    palceholder="请输入密码"
                    required
                    />
                </div>
                <button className="register-btn" type="submit">注册</button>
            </form>
            <p className="tip-text">已有账号?<span onClick={switchToLogin} className="link">登录</span></p>
        </div>
        </div>
    );
}