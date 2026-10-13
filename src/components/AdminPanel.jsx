import { useEffect, useMemo, useState } from 'react';
import './AdminPanel.css';

const API_BASE = '';
const eventLabels = {
  REGISTER: ['注册', 'register'],
  LOGIN_SUCCESS: ['登录成功', 'success'],
  LOGIN_FAILED: ['登录失败', 'failed'],
  LOGOUT: ['退出登录', 'logout'],
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '尚未登录';

export default function AdminPanel() {
  const [summary, setSummary] = useState({});
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('events');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_BASE}/api/admin/summary`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/admin/auth-events?limit=200`, { credentials: 'include' }),
    ])
      .then(async (responses) => {
        if (responses.some((response) => response.status === 403)) throw new Error('当前账号没有管理员权限');
        if (responses.some((response) => !response.ok)) throw new Error('管理数据加载失败');
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([summaryData, usersData, eventsData]) => {
        if (!active) return;
        setSummary(summaryData.summary || {});
        setUsers(usersData.users || []);
        setEvents(eventsData.events || []);
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => user.username.toLowerCase().includes(query.toLowerCase())), [query, users]);
  const filteredEvents = useMemo(() => events.filter((event) => event.username.toLowerCase().includes(query.toLowerCase())), [events, query]);

  if (loading) return <div className="admin-state"><span />正在加载权限审计数据…</div>;
  if (error) return <div className="admin-state admin-state--error"><b>!</b><h2>无法打开管理控制台</h2><p>{error}</p></div>;

  const cards = [
    ['注册用户', summary.totalUsers || 0, '全部账号'],
    ['已登录用户', summary.activeUsers || 0, '至少登录一次'],
    ['今日登录', summary.loginsToday || 0, '成功认证'],
    ['今日失败', summary.failedToday || 0, '需关注事件'],
  ];

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><span>ACCESS AUDIT</span><h1>权限与登录审计</h1><p>查看用户注册、登录状态和认证事件。密码字段永远不会在此展示。</p></div>
        <div className="admin-badge">超级管理员</div>
      </header>

      <section className="admin-stats">
        {cards.map(([label, value, hint]) => <article key={label}><span>{label}</span><strong>{Number(value)}</strong><small>{hint}</small></article>)}
      </section>

      <section className="admin-console">
        <div className="admin-toolbar">
          <div className="admin-tabs">
            <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>认证日志 <span>{events.length}</span></button>
            <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>用户列表 <span>{users.length}</span></button>
          </div>
          <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="按用户名筛选" /></label>
        </div>

        {tab === 'events' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>用户</th><th>认证事件</th><th>发生时间</th><th>IP 地址</th><th>设备</th></tr></thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const eventMeta = eventLabels[event.event_type] || [event.event_type, 'default'];
                  return <tr key={event.id}><td><strong>{event.username}</strong>{event.role === 'super_admin' && <small>管理员</small>}</td><td><span className={`admin-event admin-event--${eventMeta[1]}`}>{eventMeta[0]}</span></td><td>{formatDate(event.created_at)}</td><td><code>{event.ip_address || '—'}</code></td><td className="admin-device" title={event.user_agent || ''}>{event.user_agent || '未知设备'}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>账号</th><th>角色</th><th>注册时间</th><th>最后登录</th><th>登录次数</th><th>记忆数量</th></tr></thead>
              <tbody>{filteredUsers.map((user) => <tr key={user.id}><td><strong>{user.username}</strong><small>UID {user.id}</small></td><td><span className={`admin-role admin-role--${user.role}`}>{user.role === 'super_admin' ? '超级管理员' : '普通用户'}</span></td><td>{formatDate(user.created_at)}</td><td>{formatDate(user.last_login_at)}</td><td>{user.login_count}</td><td>{user.memory_count}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
