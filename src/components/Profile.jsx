import { useEffect, useMemo, useRef, useState } from 'react';
import './Profile.css';

const API_BASE = '';
const avatarCharacters = ['🧙‍♀️', '🧚‍♀️', '🥷', '🦸‍♀️', '🧝‍♀️', '👩‍🚀', '🧑‍🎤', '🤖', '👸', '🧑‍🎨'];

const getAvatarIndex = (username) => Array.from(username).reduce(
  (total, character) => (total * 31 + character.codePointAt(0)) >>> 0,
  7,
) % avatarCharacters.length;

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
  const [musicCount, setMusicCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({email: '', birthday: ''});
  const [profileMessage, setProfileMessage] = useState('');
  const [editingSignature, setEditingSignature] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const [eventsOpen, setEventsOpen] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({currentPassword: '', newPassword: '', confirmPassword: ''});
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const avatarInputRef = useRef(null);

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
      fetch(`${API_BASE}/api/music`, { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error('音乐数据加载失败');
        return res.json();
      }),
    ])
      .then(([userData, memoryData, eventData, musicData]) => {
        if (!active) return;
        const currentUser = userData.isLogin ? userData.user : null;
        setUser(currentUser);
        setProfileDraft({email: currentUser?.email || '', birthday: currentUser?.birthday || ''});
        setSignatureDraft(currentUser?.signature || '');
        setMemories(Array.isArray(memoryData) ? memoryData : []);
        setAuthEvents(Array.isArray(eventData.events) ? eventData.events : []);
        setMusicCount(Array.isArray(musicData.tracks) ? musicData.tracks.length : 0);
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
  const avatarIndex = getAvatarIndex(username);
  const avatarCharacter = avatarCharacters[avatarIndex];
  const birthdayText = user?.birthday
    ? new Intl.DateTimeFormat('zh-CN', {year: 'numeric', month: 'long', day: 'numeric'}).format(new Date(`${user.birthday}T00:00:00`))
    : '未设置';

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify(profileDraft),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || '保存失败');
      setUser(data.user);
      setEditingProfile(false);
      setProfileMessage('拾光档案已更新');
    } catch (saveError) {
      setProfileMessage(saveError.message || '个人资料保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSignature = async (event) => {
    event.preventDefault();
    const signature = signatureDraft.trim();
    if (!signature) {
      setSignatureMessage('请输入个性签名，或使用删除按钮清空');
      return;
    }
    setSavingSignature(true);
    setSignatureMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/profile/signature`, {
        method: user?.signature ? 'PUT' : 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({signature}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '个签保存失败');
      setUser(data.user);
      setSignatureDraft(data.signature);
      setEditingSignature(false);
      setSignatureMessage(user?.signature ? '个签已更新' : '个签已添加');
    } catch (signatureError) {
      setSignatureMessage(signatureError.message || '个签保存失败');
    } finally {
      setSavingSignature(false);
    }
  };

  const deleteSignature = async () => {
    setSavingSignature(true);
    setSignatureMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/profile/signature`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '个签删除失败');
      setUser(data.user);
      setSignatureDraft('');
      setEditingSignature(false);
      setSignatureMessage('个签已删除');
    } catch (signatureError) {
      setSignatureMessage(signatureError.message || '个签删除失败');
    } finally {
      setSavingSignature(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('头像仅支持 JPG、PNG、WebP 或 GIF 图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('头像文件不能超过 10MB');
      return;
    }
    setUploadingAvatar(true);
    setError('');
    try {
      const body = new FormData();
      body.append('avatar', file);
      const response = await fetch(`${API_BASE}/api/profile/avatar`, {method: 'POST', credentials: 'include', body});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '头像上传失败');
      setUser(data.user);
    } catch (uploadError) {
      setError(uploadError.message || '头像上传失败');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('两次输入的新密码不一致');
      return;
    }
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/profile/password`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || '密码修改失败');
      setPasswordMessage('密码修改成功');
      setPasswordForm({currentPassword: '', newPassword: '', confirmPassword: ''});
      const eventsResponse = await fetch(`${API_BASE}/api/auth/me/events`, {credentials: 'include'});
      const eventsData = await eventsResponse.json();
      setAuthEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
    } catch (passwordError) {
      setPasswordMessage(passwordError.message || '密码修改失败');
    } finally {
      setSavingPassword(false);
    }
  };

  const cards = [
    { icon: 'pin', value: memories.length, label: '记忆足迹', hint: '在地图上重温', page: 'map', tone: 'mint' },
    { icon: 'image', value: photoCount, label: '拾光照片', hint: '查看时光相册', page: 'album', tone: 'peach' },
    { icon: 'music', value: musicCount, label: '主题歌单', hint: '听见此刻心情', page: 'music', tone: 'blue' },
  ];

  if (loading) {
    return <div className="profile-state" role="status"><span className="profile-spinner" />正在整理你的拾光档案…</div>;
  }

  return (
    <main className="profile-page">
      <section className="profile-hero" aria-labelledby="profile-title">
        <button className={`profile-avatar profile-avatar--${avatarIndex % 5}`} type="button" aria-label="上传或更换头像" disabled={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="我的头像" /> : <span aria-hidden="true">{avatarCharacter}</span>}
          <i>{uploadingAvatar ? '…' : '✎'}</i>
        </button>
        <input ref={avatarInputRef} className="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadAvatar} />
        <div className="profile-intro">
          <div className="profile-eyebrow"><span />账号在线</div>
          <h1 id="profile-title">你好，{username}</h1>
          {editingSignature ? (
            <form className="profile-signature-form" onSubmit={saveSignature}>
              <div className="profile-signature-input">
                <input
                  type="text"
                  value={signatureDraft}
                  maxLength="120"
                  autoFocus
                  placeholder="写下此刻想说的话"
                  aria-label="个性签名"
                  onChange={(event) => {
                    setSignatureDraft(event.target.value);
                    setSignatureMessage('');
                  }}
                />
                <span>{signatureDraft.length}/120</span>
              </div>
              <div className="profile-signature-actions">
                <button type="submit" disabled={savingSignature}>{savingSignature ? '保存中…' : '保存'}</button>
                <button type="button" disabled={savingSignature} onClick={() => {
                  setEditingSignature(false);
                  setSignatureDraft(user?.signature || '');
                  setSignatureMessage('');
                }}>取消</button>
                {user?.signature && <button className="is-danger" type="button" disabled={savingSignature} onClick={deleteSignature}>删除</button>}
              </div>
            </form>
          ) : (
            <div className="profile-signature">
              <p className={user?.signature ? '' : 'is-empty'}>{user?.signature || '还没有个签，写下此刻想说的话。'}</p>
              <button type="button" onClick={() => {
                setSignatureDraft(user?.signature || '');
                setEditingSignature(true);
                setSignatureMessage('');
              }}>{user?.signature ? '编辑个签' : '添加个签'}</button>
            </div>
          )}
          {signatureMessage && <small className="profile-signature-message" role="status">{signatureMessage}</small>}
        </div>
        <button className="profile-logout" type="button" onClick={onLogout}>
          <Icon name="logout" size={18} />退出登录
        </button>
      </section>

      {error && <div className="profile-alert" role="alert">{error}</div>}

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
            <h2 id="account-title">拾光档案</h2>
          </div>
          <div className="profile-heading-actions">
            <div className="profile-secure"><Icon name="shield" size={17} />会话已保护</div>
            {editingProfile ? (
              <>
                <button className="profile-action profile-action--ghost" type="button" onClick={() => {
                  setEditingProfile(false);
                  setProfileDraft({email: user?.email || '', birthday: user?.birthday || ''});
                  setProfileMessage('');
                }}>取消</button>
                <button className="profile-action" type="button" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? '保存中…' : '保存档案'}</button>
              </>
            ) : (
              <button className="profile-action" type="button" onClick={() => setEditingProfile(true)}>编辑档案</button>
            )}
          </div>
        </div>

        {profileMessage && <p className="profile-save-message" role="status">{profileMessage}</p>}

        <div className="profile-account__rows">
          <div className="profile-account__row">
            <span className="profile-account__label"><Icon name="user" size={19} />用户名</span>
            <strong>{username}</strong>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">邮箱</span>
            {editingProfile
              ? <input type="email" value={profileDraft.email} maxLength="190" placeholder="填写邮箱地址" onChange={(event) => setProfileDraft((draft) => ({...draft, email: event.target.value}))} />
              : <span>{user?.email || '未设置'}</span>}
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">登录状态</span>
            <span className="profile-online"><i />已登录</span>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">生日</span>
            {editingProfile
              ? <input type="date" value={profileDraft.birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setProfileDraft((draft) => ({...draft, birthday: event.target.value}))} />
              : <span>{birthdayText}</span>}
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">账号角色</span>
            <span>拾光者</span>
          </div>
          <div className="profile-account__row">
            <span className="profile-account__label">修改密码</span>
            <button className="profile-password-trigger" type="button" onClick={() => {
              setPasswordOpen((open) => !open);
              setPasswordMessage('');
            }}>{passwordOpen ? '收起' : '修改'}</button>
          </div>
        </div>
        {passwordOpen && (
          <form className="profile-password-form" onSubmit={changePassword}>
            <label><span>当前密码</span><input type="password" autoComplete="current-password" minLength="6" maxLength="72" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((form) => ({...form, currentPassword: event.target.value}))} /></label>
            <label><span>新密码</span><input type="password" autoComplete="new-password" minLength="6" maxLength="72" required value={passwordForm.newPassword} onChange={(event) => setPasswordForm((form) => ({...form, newPassword: event.target.value}))} /></label>
            <label><span>确认新密码</span><input type="password" autoComplete="new-password" minLength="6" maxLength="72" required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((form) => ({...form, confirmPassword: event.target.value}))} /></label>
            <button type="submit" disabled={savingPassword}>{savingPassword ? '修改中…' : '确认修改'}</button>
            {passwordMessage && <p role="status">{passwordMessage}</p>}
          </form>
        )}
      </section>

      <section className={`profile-security${eventsOpen ? '' : ' profile-security--collapsed'}`} aria-labelledby="security-title">
        <div className="profile-section-heading">
          <div><span>LATEST RECORD</span><h2 id="security-title">我的登记记录</h2></div>
          <button className="profile-events-toggle" type="button" aria-expanded={eventsOpen} aria-controls="profile-events-list" onClick={() => setEventsOpen((open) => !open)}>
            <Icon name="clock" size={17} />{eventsOpen ? '收起记录' : '展开记录'}<b aria-hidden="true">{eventsOpen ? '⌃' : '⌄'}</b>
          </button>
        </div>
        {eventsOpen && <div className="profile-events" id="profile-events-list">
          {authEvents.length === 0 ? <p className="profile-events__empty">暂无登记记录</p> : authEvents.slice(0, 1).map((event) => {
            const labels = { REGISTER: '账号注册', LOGIN_SUCCESS: '登录成功', LOGIN_FAILED: '登录失败', LOGOUT: '退出登录', PASSWORD_CHANGE: '密码已修改' };
            return (
              <article key={event.id}>
                <span className={`profile-event-dot profile-event-dot--${event.event_type.toLowerCase()}`} />
                <div><strong>{labels[event.event_type] || event.event_type}</strong><small>{event.ip_address || '未知地址'}</small></div>
                <time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</time>
              </article>
            );
          })}
        </div>}
      </section>
    </main>
  );
}
