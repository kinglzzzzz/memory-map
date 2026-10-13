import { useEffect, useMemo, useState } from 'react';
import './Profile.css';

const API_BASE = '';

const Icon = ({ name, size = 20 }) => {
  const paths = {
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4.5-4.5L7 20"/></>,
    music: <><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

export default function Profile({ onNavigate = () => {}, onLogout = () => {} }) {
  const [user, setUser] = useState(null);
  const [memories, setMemories] = useState([]);
  const [authEvents, setAuthEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch(`${API_BASE}/api/get-user`, { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error('账号信息加载失败');
        return res.json();
      }),
      fetch(`${API_BASE}/api/memories`, { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error('记忆数据加载失败');
        return res.json();
      }),
      fetch(`${API_BASE}/api/auth/me/events`, { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error('登录记录加载失败');
        return res.json();
      }),
    ])
      .then(([userData, memoryData, eventData]) => {
        if (!active) return;
        setUser(userData.isLogin ? userData.user : null);
        setMemories(Array.isArray(memoryData) ? memoryData : []);
        setAuthEvents(Array.isArray(eventData.events) ? eventData.events : []);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, []);

  const photoCount = useMemo(
    () => memories.filter((memory) => Boolean(memory.imgSrc)).length,
    [memories],
  );
  const username = user?.username || '未登录用户';
  const initials = username.slice(0, 1).toUpperCase();
  const accountId = user?.id ? `MEM-${String(user.id).padStart(5, '0')}` : '—';

  const cards = [
    { icon: 'pin', value: memories.length, label: '记忆足迹', hint: '在地图上重温', page: 'map', tone: 'mint' },
    { icon: 'image', value: photoCount, label: '拾光照片', hint: '查看时光相册', page: 'album', tone: 'peach' },
    { icon: 'music', value: 6, label: '主题歌单', hint: '听见此刻心情', page: 'music', tone: 'blue' },
  ];

  if (loading) {
    return <div className="profile-state" role="status"><span className="profile-spinner" />正在整理你的拾光档案…</div>;
  }

  return (
    <main className="profile-page">
      <section className="profile-hero" aria-labelledby="profile-title">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="profile-intro">
          <div className="profile-eyebrow"><span />账号在线</div>
          <h1 id="profile-title">你好，{username}</h1>
          <p>每一处坐标，都在替你保存一段温柔的时间。</p>
        </div>
        <button className="profile-logout" type="button" onClick={onLogout}>
          <Icon name="logout" size={18} />退出登录
        </button>
      </section>

      {error && <div className="profile-alert" role="alert">{error}，部分数据暂时无法展示。</div>}

      <section className="profile-grid" aria-label="个人数据概览">
        {cards.map((card) => (
          <button className={`profile-stat profile-stat--${card.tone}`} type="button" key={card.label} onClick={() => onNavigate(card.page)}>
            <span className="profile-stat__icon"><Icon name={card.icon} size={22} /></span>
            <span className="profile-stat__content">
              <strong>{card.value}</strong>
              <span>{card.label}</span>
              <small>{card.hint}</small>
            </span>
            <span className="profile-stat__arrow"><Icon name="arrow" size={18} /></span>
          </button>
        ))}
      </section>

      <section className="profile-account" aria-labelledby="account-title">
        <div className="profile-section-heading">
          <div>
            <span>ACCOUNT</span>
            <h2 id="account-title">账号信息</h2>
          </div>
          <div className="profile-secure"><Icon name="shield" size={17} />会话已保护</div>
        </div>

        <div className="profile-account__rows">
          <div className="profile-account__row">
            <span className="profile-account__label"><Icon name="user" size={19} />用户名</span>
            <strong>{username}</strong>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">账号编号</span>
            <code>{accountId}</code>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">登录状态</span>
            <span className="profile-online"><i />已登录</span>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">数据归属</span>
            <span>仅当前账号可见</span>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">账号角色</span>
            <span>{user?.role === 'super_admin' ? '超级管理员' : '普通用户'}</span>
          </div>
        </div>
      </section>

      <section className="profile-security" aria-labelledby="security-title">
        <div className="profile-section-heading">
          <div><span>SECURITY LOG</span><h2 id="security-title">我的注册与登录记录</h2></div>
          <div className="profile-secure"><Icon name="clock" size={17} />仅你自己可见</div>
        </div>
        <div className="profile-events">
          {authEvents.length === 0 ? <p className="profile-events__empty">暂无登录记录</p> : authEvents.slice(0, 10).map((event) => {
            const labels = { REGISTER: '账号注册', LOGIN_SUCCESS: '登录成功', LOGIN_FAILED: '登录失败', LOGOUT: '退出登录' };
            return (
              <article key={event.id}>
                <span className={`profile-event-dot profile-event-dot--${event.event_type.toLowerCase()}`} />
                <div><strong>{labels[event.event_type] || event.event_type}</strong><small>{event.ip_address || '未知地址'}</small></div>
                <time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</time>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
