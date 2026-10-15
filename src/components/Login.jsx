import { useState } from 'react';
import './Register.css';

const API_BASE = '';

export default function Login({ switchToRegister = () => {}, onLoginSuccess = () => {} }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || '登录失败');
      onLoginSuccess(data.user);
    } catch (submitError) {
      setError(submitError.message || '无法连接登录服务');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <section className="auth-showcase">
        <div className="auth-brand auth-brand--wordmark">拾光记忆</div>
        <div className="auth-showcase__copy">
          <span className="auth-kicker">YOUR MEMORY ATLAS</span>
          <h1>让散落的时光，<br />重新拥有坐标。</h1>
          <p>记录地点、照片与心情。</p>
        </div>
        <div className="auth-map-art" aria-hidden="true">
          <i className="auth-route auth-route--one" />
          <i className="auth-route auth-route--two" />
          <span className="auth-photo-pin auth-photo-pin--one"><img src="/bg-sea.png" alt="" /></span>
          <span className="auth-photo-pin auth-photo-pin--two"><img src="/bg-sea.png" alt="" /></span>
          <span className="auth-photo-pin auth-photo-pin--three"><img src="/bg-sea.png" alt="" /></span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card__heading">
            <div className="auth-welcome">
              <span>欢迎回来</span>
              <em>WELCOME BACK</em>
            </div>
            <h2>登录拾光地图</h2>
          </div>

          {error && <div className="auth-error" role="alert"><span>!</span>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>用户名</span>
              <div>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="输入你的用户名" autoComplete="username" minLength="2" required />
              </div>
            </label>

            <label className="auth-field">
              <span>密码</span>
              <div>
                <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入登录密码" autoComplete="current-password" required />
                <button
                  className="auth-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a16.7 16.7 0 0 1-3.1 3.6M6.6 6.6C4.4 8 3 10 3 10s3.5 5 9 5c1 0 1.9-.2 2.7-.4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? <><i />正在验证…</> : <>登录<span>→</span></>}
            </button>
          </form>

          <p className="auth-switch">还没有账号？<button type="button" onClick={switchToRegister}>创建新账号</button></p>
        </div>
      </section>
    </main>
  );
}
