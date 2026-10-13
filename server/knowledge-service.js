const seedEntries = require('../knowledge/seed.json');

const safeJsonParse = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const mapKnowledgeRow = (row) => ({
  id: row.slug,
  slug: row.slug,
  category: row.category,
  icon: row.icon,
  title: row.title,
  summary: row.summary,
  content: row.content,
  answer: row.content,
  steps: safeJsonParse(row.steps_json),
  keywords: safeJsonParse(row.keywords_json),
  sourceLabel: row.source_label || '拾光方法库',
  sourceUrl: row.source_url || '',
});

async function ensureKnowledgeSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(80) NOT NULL,
      category VARCHAR(40) NOT NULL,
      icon VARCHAR(16) NOT NULL DEFAULT '·',
      title VARCHAR(120) NOT NULL,
      summary VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      source_label VARCHAR(120) NOT NULL DEFAULT '拾光方法库',
      source_url VARCHAR(500) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_knowledge_slug (slug),
      KEY idx_knowledge_category (category),
      KEY idx_knowledge_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_agent_user_time (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const entry of seedEntries) {
    await db.query(`
      INSERT INTO knowledge_entries
        (slug, category, icon, title, summary, content, steps_json, keywords_json, source_label, source_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        category = VALUES(category), icon = VALUES(icon), title = VALUES(title),
        summary = VALUES(summary), content = VALUES(content), steps_json = VALUES(steps_json),
        keywords_json = VALUES(keywords_json), source_label = VALUES(source_label),
        source_url = VALUES(source_url), is_active = 1
    `, [
      entry.slug,
      entry.category,
      entry.icon,
      entry.title,
      entry.summary,
      entry.content,
      JSON.stringify(entry.steps),
      JSON.stringify(entry.keywords),
      entry.sourceLabel || '拾光方法库',
      entry.sourceUrl || null,
    ]);
  }
}

async function listKnowledge(db) {
  const [rows] = await db.query(`
    SELECT slug, category, icon, title, summary, content, steps_json,
           keywords_json, source_label, source_url
    FROM knowledge_entries
    WHERE is_active = 1
    ORDER BY category, id
  `);
  return rows.map(mapKnowledgeRow);
}

function rankKnowledge(entries, query) {
  const normalized = query.toLowerCase().replace(/\s+/g, '');
  return entries
    .map((entry) => {
      let score = 0;
      if (normalized.includes(entry.category.toLowerCase())) score += 5;
      if (normalized.includes(entry.title.toLowerCase())) score += 8;
      for (const keyword of entry.keywords) {
        const token = String(keyword).toLowerCase().replace(/\s+/g, '');
        if (normalized.includes(token)) score += token.length > 1 ? 4 : 1;
      }
      for (let index = 0; index < normalized.length - 1; index += 1) {
        const pair = normalized.slice(index, index + 2);
        if (entry.title.includes(pair)) score += 0.8;
        if (entry.summary.includes(pair)) score += 0.35;
      }
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildMemoryContext(query, memories) {
  if (!memories.length) return '';
  const normalized = query.replace(/\s+/g, '');
  const wantsPersonalContext = ['我', '我的', '足迹', '记忆', '照片', '相册', '回顾', '统计', '多少']
    .some((token) => normalized.includes(token));
  if (!wantsPersonalContext) return '';

  const photoCount = memories.filter((memory) => memory.imgSrc).length;
  const titled = memories.filter((memory) => memory.title).slice(0, 3);
  const titles = titled.map((memory) => `「${memory.title}」`).join('、');
  return `你的账号目前有 ${memories.length} 个记忆坐标，其中 ${photoCount} 条带有照片。${titles ? `最近可以优先整理 ${titles}。` : ''}`;
}

function buildAnswer(query, matches, memories) {
  const memoryContext = buildMemoryContext(query, memories);
  if (!matches.length) {
    return {
      answer: `${memoryContext ? `${memoryContext}\n\n` : ''}知识库中暂时没有完全对应的条目。你可以补充想整理的地点、照片或情绪，也可以从记忆整理、旅行规划、照片叙事、情绪记录、音乐场景和地图足迹中选择一个主题。`,
      sources: [],
    };
  }

  const primary = matches[0];
  const related = matches.slice(1);
  const steps = primary.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const relatedText = related.length ? `\n\n还可以结合：${related.map((item) => `「${item.title}」`).join('、')}。` : '';
  return {
    answer: `${memoryContext ? `${memoryContext}\n\n` : ''}${primary.content}\n\n建议按下面的步骤开始：\n${steps}${relatedText}`,
    sources: matches.map((item) => ({
      id: item.slug,
      title: item.title,
      category: item.category,
      sourceLabel: item.sourceLabel,
    })),
  };
}

async function answerAgentQuery(db, userId, query) {
  const [entries, memoryResult] = await Promise.all([
    listKnowledge(db),
    db.query(`
      SELECT id, title, mood, lat, lng, imgSrc
      FROM memories
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 80
    `, [userId]),
  ]);
  const memories = memoryResult[0];
  const matches = rankKnowledge(entries, query);
  const result = buildAnswer(query, matches, memories);

  await db.query(
    'INSERT INTO agent_messages (user_id, role, content, sources_json) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    [userId, 'user', query, null, userId, 'assistant', result.answer, JSON.stringify(result.sources)],
  );
  return { ...result, matchedCount: matches.length, memoryCount: memories.length };
}

module.exports = {
  answerAgentQuery,
  ensureKnowledgeSchema,
  listKnowledge,
  safeJsonParse,
};
