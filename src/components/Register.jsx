import { useState } from 'react';
import './Register.css';

const API_BASE = '';

export default function Register({ switchToLogin = () => {} }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, birthday, password }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || '注册失败');
      setMessage({ type: 'success', text: '账号创建成功，即将返回登录页…' });
      window.setTimeout(switchToLogin, 700);
    } catch (submitError) {
      setMessage({ type: 'error', text: submitError.message || '无法连接注册服务' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--register">
      <section className="auth-showcase">
        <div className="auth-brand"><span>拾</span>拾光记忆</div>
        <div className="auth-showcase__copy">
          <span className="auth-kicker">START YOUR ARCHIVE</span>
          <h1>从第一个地点，<br />建立你的时光档案。</h1>
          <p>建立属于你的拾光档案，让每段记忆都有清晰归属。</p>
        </div>
        <div className="auth-privacy"><span>✓</span>密码哈希存储 · 默认最小权限 · 注册行为留痕</div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card__heading"><span>创建账号</span><h2>加入拾光地图</h2><p>用户名 2–40 字符，密码至少 6 位</p></div>
          {message && <div className={`auth-error auth-error--${message.type}`} role="alert"><span>{message.type === 'success' ? '✓' : '!'}</span>{message.text}</div>}
          <form onSubmit={handleSubmit}>
            <label className="auth-field"><span>用户名</span><div><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="设置用户名" autoComplete="username" minLength="2" maxLength="40" required /></div></label>
            <label className="auth-field"><span>邮箱</span><div><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用于完善拾光档案" autoComplete="email" maxLength="190" required /></div></label>
            <label className="auth-field"><span>生日</span><div><input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" required /></div></label>
            <label className="auth-field"><span>密码</span><div><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位密码" autoComplete="new-password" minLength="6" maxLength="72" required /></div></label>
            <label className="auth-field"><span>确认密码</span><div><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" required /></div></label>
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? '正在创建…' : <>创建拾光者账号<span>→</span></>}</button>
          </form>
          <p className="auth-switch">已有账号？<button type="button" onClick={switchToLogin}>返回登录</button></p>
        </div>
      </section>
    </main>
  );
}
