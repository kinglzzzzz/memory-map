import { useEffect, useMemo, useRef, useState } from 'react';
import { knowledgeBase as localKnowledge } from '../data/agentKnowledge';
import './Agent.css';

const API_BASE = '';
const quickPrompts = ['帮我整理旅行记忆', '如何写一段地点故事？', '给照片挑选叙事主题', '根据我的足迹生成回顾'];
const welcomeMessage = {
  role: 'agent',
  text: '你好，我是拾光 Agent。我会先检索主题知识库，再结合你账号中的地点与照片记忆给出建议。今天想从哪里开始？',
  sources: [{ title: '拾光知识库', category: '系统' }],
};

function localRetrieve(query, memories) {
  const normalized = query.toLowerCase().replace(/\s/g, '');
  const ranked = localKnowledge
    .map((item) => ({
      ...item,
      score: item.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.toLowerCase()) ? 4 : 0), 0)
        + (normalized.includes(item.category) ? 3 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const personalIntent = ['我', '足迹', '记忆', '照片', '相册', '回顾', '多少'].some((word) => normalized.includes(word));
  const context = personalIntent && memories.length
    ? `你的账号目前有 ${memories.length} 个记忆坐标，其中 ${memories.filter((item) => item.imgSrc).length} 条带有照片。\n\n`
    : '';

  if (!ranked.length) {
    return {
      text: `${context}暂时没有找到完全对应的条目。请补充想整理的地点、照片或情绪，或从左侧选择一个知识主题。`,
      sources: [{ title: '本地知识导航', category: '降级模式' }],
    };
  }

  const main = ranked[0];
  return {
    text: `${context}${main.content}\n\n建议按下面的步骤开始：\n${main.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
    sources: ranked.map((item) => ({ title: item.title, category: item.category })),
  };
}

const sourceTitle = (source) => typeof source === 'string' ? source : source.title;

export default function Agent({ memories = [] }) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [knowledge, setKnowledge] = useState(localKnowledge);
  const [categories, setCategories] = useState([...new Set(localKnowledge.map((item) => item.category))]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [databaseMode, setDatabaseMode] = useState('connecting');
  const [lastContextCount, setLastContextCount] = useState(memories.length);
  const endRef = useRef(null);

  const visibleKnowledge = useMemo(
    () => activeCategory === '全部' ? knowledge : knowledge.filter((item) => item.category === activeCategory),
    [activeCategory, knowledge],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_BASE}/api/knowledge`, { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('知识库接口不可用');
        return response.json();
      }),
      fetch(`${API_BASE}/api/agent/history?limit=40`, { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('历史接口不可用');
        return response.json();
      }),
    ])
      .then(([knowledgeData, historyData]) => {
        if (!active) return;
        if (knowledgeData.entries?.length) {
          setKnowledge(knowledgeData.entries);
          setCategories(knowledgeData.categories);
        }
        if (historyData.messages?.length) setMessages(historyData.messages);
        setDatabaseMode('connected');
      })
      .catch(() => active && setDatabaseMode('local'));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const sendMessage = async (text = input) => {
    const question = text.trim();
    if (!question || thinking) return;
    setMessages((current) => [...current, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);

    try {
      const response = await fetch(`${API_BASE}/api/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: question }),
      });
      if (!response.ok) throw new Error('Agent 接口不可用');
      const data = await response.json();
      setMessages((current) => [...current, { role: 'agent', text: data.answer, sources: data.sources }]);
      setLastContextCount(data.memoryCount ?? memories.length);
      setDatabaseMode('connected');
    } catch {
      setMessages((current) => [...current, { role: 'agent', ...localRetrieve(question, memories) }]);
      setDatabaseMode('local');
    } finally {
      setThinking(false);
    }
  };

  const openKnowledge = (item) => {
    setMessages((current) => [...current, {
      role: 'agent',
      text: `「${item.title}」\n${item.content || item.answer}\n\n实践清单：\n${item.steps.map((step) => `· ${step}`).join('\n')}`,
      sources: [{ title: item.title, category: item.category }],
    }]);
  };

  const clearHistory = async () => {
    setMessages([welcomeMessage]);
    try {
      await fetch(`${API_BASE}/api/agent/history`, { method: 'DELETE', credentials: 'include' });
    } catch {
      // 本地降级模式下只清理当前页面会话。
    }
  };

  return (
    <main className="agent-page">
      <header className="agent-header">
        <div>
          <span className="agent-kicker">MEMORY RETRIEVAL ASSISTANT</span>
          <h1>拾光 Agent</h1>
        </div>
        <div className={`agent-status agent-status--${databaseMode}`}>
          <i />
          {databaseMode === 'connected' && `MySQL 知识库已连接 · ${knowledge.length} 条`}
          {databaseMode === 'connecting' && '正在连接知识库…'}
          {databaseMode === 'local' && `本地知识库模式 · ${knowledge.length} 条`}
        </div>
      </header>

      <div className="agent-layout">
        <aside className="knowledge-panel">
          <div className="knowledge-panel__title">
            <span>知识库</span>
            <small>{visibleKnowledge.length} 条</small>
          </div>
          <div className="knowledge-categories">
            {['全部', ...categories].map((category) => (
              <button type="button" className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)}>{category}</button>
            ))}
          </div>
          <div className="knowledge-list">
            {visibleKnowledge.map((item) => (
              <button type="button" key={item.id || item.slug} onClick={() => openKnowledge(item)}>
                <span className="knowledge-icon">{item.icon}</span>
                <span><strong>{item.title}</strong><small>{item.summary}</small></span>
                <b>›</b>
              </button>
            ))}
          </div>
          <div className="knowledge-note">
            <strong>{lastContextCount}</strong>
            <span>条当前用户记忆可参与回答</span>
          </div>
        </aside>

        <section className="agent-chat" aria-label="与拾光 Agent 对话">
          <div className="agent-chat__top">
            <div className="agent-avatar">光</div>
            <div><strong>拾光记忆助手</strong><span><i />在线 · 检索增强回答</span></div>
            <button className="agent-clear" type="button" onClick={clearHistory}>清空对话</button>
          </div>

          <div className="agent-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`agent-message agent-message--${message.role}`} key={message.id || `${message.role}-${index}`}>
                {message.role === 'agent' && <span className="agent-message__avatar">光</span>}
                <div>
                  <p>{message.text}</p>
                  {message.sources?.length > 0 && (
                    <div className="agent-sources">
                      <span>知识来源</span>
                      {message.sources.map((source, sourceIndex) => (
                        <em key={`${sourceTitle(source)}-${sourceIndex}`} title={typeof source === 'object' ? source.category : ''}>{sourceTitle(source)}</em>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="agent-message agent-message--agent">
                <span className="agent-message__avatar">光</span>
                <div className="agent-thinking"><i /><i /><i /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="agent-quick-prompts">
            {quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}
          </div>

          <div className="agent-composer">
            <textarea
              value={input}
              maxLength="500"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="例如：根据我的照片和足迹，怎样整理一次旅行故事？"
              rows="2"
            />
            <button type="button" onClick={() => sendMessage()} disabled={!input.trim() || thinking} aria-label="发送消息">
              <svg viewBox="0 0 24 24"><path d="m4 4 17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/></svg>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
