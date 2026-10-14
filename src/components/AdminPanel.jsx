import { useCallback, useEffect, useMemo, useState } from 'react';
import './AdminPanel.css';

const API_BASE = '';
const eventLabels = {
  REGISTER: ['注册', 'register'],
  LOGIN_SUCCESS: ['登录成功', 'success'],
  LOGIN_FAILED: ['登录失败', 'failed'],
  ADMIN_LOGIN_DENIED: ['管理端拒绝', 'failed'],
  ADMIN_GRANTED: ['授予管理员', 'admin'],
  ADMIN_REVOKED: ['撤销管理员', 'admin'],
  PASSWORD_CHANGE: ['修改密码', 'default'],
  LOGOUT: ['退出登录', 'logout'],
};
const contentLabels = {
  memories: ['记忆数据', 'memories'],
  music: ['音乐数据', 'music_tracks'],
  knowledge: ['知识库', 'knowledge_entries'],
  agent: ['Agent 对话', 'agent_messages'],
};

const formatDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
};

async function apiRequest(path, options) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || '操作失败');
  return data;
}

export default function AdminPanel({ section = 'overview', onSectionChange = () => {} }) {
  const [dashboard, setDashboard] = useState({ summary: {}, tables: [], recentUsers: [], recentMemories: [] });
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [datasets, setDatasets] = useState({ memories: [], music: [], knowledge: [], agent: [] });
  const [contentType, setContentType] = useState('memories');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = useCallback(async () => {
    setError('');
    const [summaryData, usersData, eventsData, memoriesData, musicData, knowledgeData, agentData] = await Promise.all([
      apiRequest('/api/admin/summary'),
      apiRequest('/api/admin/users'),
      apiRequest('/api/admin/auth-events?limit=300'),
      apiRequest('/api/admin/data/memories?limit=300'),
      apiRequest('/api/admin/data/music?limit=300'),
      apiRequest('/api/admin/data/knowledge?limit=300'),
      apiRequest('/api/admin/data/agent?limit=300'),
    ]);
    setDashboard(summaryData);
    setUsers(usersData.users || []);
    setEvents(eventsData.events || []);
    setDatasets({
      memories: memoriesData.rows || [],
      music: musicData.rows || [],
      knowledge: knowledgeData.rows || [],
      agent: agentData.rows || [],
    });
  }, []);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- initial remote data synchronization
    loadAll()
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadAll]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const refresh = async (message) => {
    await loadAll();
    showNotice(message);
  };

  const updateRole = async (user) => {
    const role = user.role === 'super_admin' ? 'user' : 'super_admin';
    const action = role === 'super_admin' ? '授予超级管理员权限' : '撤销超级管理员权限';
    if (!window.confirm(`确定要为“${user.username}”${action}吗？`)) return;
    setBusy(`role-${user.id}`);
    try {
      await apiRequest(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
      });
      await refresh('账号角色已更新');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const deleteUser = async (user) => {
    const confirmed = window.confirm(`高风险操作：删除“${user.username}”会同时清除该账号的记忆、音乐、Agent 对话和认证日志，且无法恢复。确定继续吗？`);
    if (!confirmed) return;
    setBusy(`user-${user.id}`);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      await refresh('账号及其关联数据已删除');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const deleteRecord = async (type, row) => {
    const name = row.title || row.username || `#${row.id}`;
    if (!window.confirm(`确定删除${contentLabels[type][0]}记录“${name}”吗？此操作无法恢复。`)) return;
    setBusy(`${type}-${row.id}`);
    try {
      await apiRequest(`/api/admin/data/${type}/${row.id}`, { method: 'DELETE' });
      await refresh('数据库记录已删除');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const toggleKnowledge = async (row) => {
    setBusy(`knowledge-${row.id}`);
    try {
      await apiRequest(`/api/admin/knowledge/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !row.is_active }),
      });
      await refresh(row.is_active ? '知识条目已停用' : '知识条目已启用');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(() => users.filter((user) => [user.username, user.email, user.role]
    .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))), [normalizedQuery, users]);
  const filteredEvents = useMemo(() => events.filter((event) => [event.username, event.event_type, event.ip_address]
    .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))), [events, normalizedQuery]);
  const filteredContent = useMemo(() => (datasets[contentType] || []).filter((row) => Object.values(row)
    .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))), [contentType, datasets, normalizedQuery]);

  if (loading) return <div className="admin-state"><span />正在连接管理数据库…</div>;
  if (error && !dashboard.tables.length) return <div className="admin-state admin-state--error"><b>!</b><h2>无法打开管理控制台</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>重新加载</button></div>;

  const summary = dashboard.summary || {};
  const cards = [
    ['注册用户', summary.totalUsers, '账号总数', 'users'],
    ['今日活跃', summary.loginsToday, '成功登录次数', 'active'],
    ['记忆坐标', summary.memories, `${summary.photos || 0} 张照片`, 'memories'],
    ['音乐内容', summary.musicTracks, '全站曲目', 'music'],
    ['知识条目', summary.activeKnowledge, `共 ${summary.knowledgeEntries || 0} 条`, 'knowledge'],
    ['Agent 消息', summary.agentMessages, '累计对话消息', 'agent'],
  ];

  const renderOverview = () => (
    <>
      <section className="admin-stats">
        {cards.map(([label, value, hint, tone]) => <article className={`admin-stat admin-stat--${tone}`} key={label}><span>{label}</span><strong>{Number(value) || 0}</strong><small>{hint}</small></article>)}
      </section>
      <div className="admin-overview-grid">
        <section className="admin-console admin-database-map">
          <div className="admin-section-heading"><div><span>DATABASE</span><h2>数据表运行概览</h2></div><small>仅开放经过授权的安全管理操作</small></div>
          <div className="admin-table-cards">
            {(dashboard.tables || []).map((table) => <button type="button" key={table.key} onClick={() => {
              if (table.key === 'users') onSectionChange('users');
              else if (table.key === 'events') onSectionChange('events');
              else { setContentType(table.key); onSectionChange('content'); }
            }}><span>{table.table}</span><strong>{Number(table.count) || 0}</strong><small>{table.label} →</small></button>)}
          </div>
        </section>
        <section className="admin-console admin-recent">
          <div className="admin-section-heading"><div><span>LATEST</span><h2>最近注册</h2></div></div>
          {(dashboard.recentUsers || []).map((user) => <div className="admin-recent-row" key={user.id}><span className="admin-avatar">{user.username?.slice(0, 1).toUpperCase()}</span><div><strong>{user.username}</strong><small>{formatDate(user.created_at)}</small></div><em>{user.role === 'super_admin' ? '管理员' : '拾光者'}</em></div>)}
        </section>
      </div>
    </>
  );

  const renderUsers = () => (
    <section className="admin-console">
      <div className="admin-toolbar"><div><span>USER ACCESS</span><h2>账号与权限管理</h2></div><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户名、邮箱或角色" /></label></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>账号</th><th>联系资料</th><th>角色</th><th>注册 / 最后登录</th><th>业务数据</th><th>权限操作</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}>
        <td><strong>{user.username}</strong><small>UID {user.id}</small></td>
        <td>{user.email || '未填写'}<small>{user.birthday || '生日未填写'}</small></td>
        <td><span className={`admin-role admin-role--${user.role}`}>{user.role === 'super_admin' ? '超级管理员' : '拾光者'}</span></td>
        <td>{formatDate(user.created_at)}<small>登录：{formatDate(user.last_login_at, '从未登录')}</small></td>
        <td>{user.memory_count} 记忆 · {user.music_count} 音乐<small>{user.login_count} 次登录 · {user.agent_message_count} 条 Agent 消息</small></td>
        <td><div className="admin-actions"><button type="button" disabled={busy === `role-${user.id}`} onClick={() => updateRole(user)}>{user.role === 'super_admin' ? '设为拾光者' : '设为管理员'}</button><button className="danger" type="button" disabled={busy === `user-${user.id}`} onClick={() => deleteUser(user)}>删除账号</button></div></td>
      </tr>)}</tbody></table></div>
    </section>
  );

  const renderContentRows = () => filteredContent.map((row) => {
    if (contentType === 'memories') return <tr key={row.id}><td><strong>{row.title || '未命名记忆'}</strong><small>#{row.id} · {row.username || `UID ${row.user_id}`}</small></td><td className="admin-cell-wrap">{row.mood || '无心情文字'}</td><td><code>{row.lat}, {row.lng}</code></td><td>{row.imgSrc ? '有照片' : '无照片'}</td><td><button className="admin-delete" disabled={busy === `memories-${row.id}`} onClick={() => deleteRecord('memories', row)}>删除</button></td></tr>;
    if (contentType === 'music') return <tr key={row.id}><td><strong>{row.title}</strong><small>#{row.id} · {row.username || `UID ${row.user_id}`}</small></td><td>{row.artist || '未知创作者'}</td><td><span className="admin-chip">{row.theme}</span></td><td>{formatDate(row.created_at)}</td><td><button className="admin-delete" disabled={busy === `music-${row.id}`} onClick={() => deleteRecord('music', row)}>删除</button></td></tr>;
    if (contentType === 'knowledge') return <tr key={row.id}><td><strong>{row.title}</strong><small>{row.slug}</small></td><td><span className="admin-chip">{row.category}</span></td><td className="admin-cell-wrap">{row.summary}</td><td><span className={`admin-status ${row.is_active ? 'is-active' : ''}`}>{row.is_active ? '已启用' : '已停用'}</span></td><td><button disabled={busy === `knowledge-${row.id}`} onClick={() => toggleKnowledge(row)}>{row.is_active ? '停用' : '启用'}</button></td></tr>;
    return <tr key={row.id}><td><strong>{row.username || `UID ${row.user_id}`}</strong><small>#{row.id} · {row.role === 'assistant' ? 'Agent' : '用户'}</small></td><td className="admin-cell-wrap admin-message-cell">{row.content}</td><td>{formatDate(row.created_at)}</td><td><button className="admin-delete" disabled={busy === `agent-${row.id}`} onClick={() => deleteRecord('agent', row)}>删除</button></td></tr>;
  });

  const renderContent = () => {
    const headers = contentType === 'memories' ? ['记忆', '心情', '坐标', '照片', '操作']
      : contentType === 'music' ? ['曲目', '创作者', '主题', '创建时间', '操作']
        : contentType === 'knowledge' ? ['条目', '分类', '摘要', '状态', '操作']
          : ['账号', '消息内容', '发送时间', '操作'];
    return <section className="admin-console"><div className="admin-toolbar admin-toolbar--content"><div className="admin-content-tabs">{Object.entries(contentLabels).map(([key, meta]) => <button type="button" className={contentType === key ? 'active' : ''} onClick={() => setContentType(key)} key={key}>{meta[0]} <span>{datasets[key].length}</span></button>)}</div><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前数据表" /></label></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{renderContentRows()}</tbody></table></div></section>;
  };

  const renderEvents = () => (
    <section className="admin-console"><div className="admin-toolbar"><div><span>SECURITY AUDIT</span><h2>认证与权限日志</h2></div><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户、事件或 IP" /></label></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>用户</th><th>认证事件</th><th>发生时间</th><th>IP 地址</th><th>设备</th></tr></thead><tbody>{filteredEvents.map((event) => { const eventMeta = eventLabels[event.event_type] || [event.event_type, 'default']; return <tr key={event.id}><td><strong>{event.username}</strong>{event.role === 'super_admin' && <small>超级管理员</small>}</td><td><span className={`admin-event admin-event--${eventMeta[1]}`}>{eventMeta[0]}</span></td><td>{formatDate(event.created_at)}</td><td><code>{event.ip_address || '—'}</code></td><td className="admin-device" title={event.user_agent || ''}>{event.user_agent || '未知设备'}</td></tr>; })}</tbody></table></div></section>
  );

  return (
    <main className="admin-page">
      <header className="admin-header"><div><span>MEMORY MAP · CONTROL CENTER</span><h1>{section === 'overview' ? '数据总览' : section === 'users' ? '用户管理' : section === 'content' ? '内容数据库' : '安全审计'}</h1><p>管理用户与业务数据，所有操作都经过超级管理员权限校验。</p></div><div className="admin-badge"><i />超级管理员</div></header>
      {error && <div className="admin-alert" role="alert"><span>!</span>{error}<button onClick={() => setError('')}>×</button></div>}
      {notice && <div className="admin-toast" role="status">✓ {notice}</div>}
      {section === 'overview' && renderOverview()}
      {section === 'users' && renderUsers()}
      {section === 'content' && renderContent()}
      {section === 'events' && renderEvents()}
    </main>
  );
}
