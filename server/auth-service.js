async function columnExists(db, tableName, columnName) {
  const [rows] = await db.query(`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [tableName, columnName]);
  return Number(rows[0].count) > 0;
}

async function ensureAuthSchema(db) {
  if (!(await columnExists(db, 'app_user', 'role'))) {
    await db.query("ALTER TABLE app_user ADD COLUMN role VARCHAR(24) NOT NULL DEFAULT 'user'");
  }
  if (!(await columnExists(db, 'app_user', 'created_at'))) {
    await db.query('ALTER TABLE app_user ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!(await columnExists(db, 'app_user', 'last_login_at'))) {
    await db.query('ALTER TABLE app_user ADD COLUMN last_login_at DATETIME NULL');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NULL,
      username_snapshot VARCHAR(120) NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_auth_user_time (user_id, created_at),
      KEY idx_auth_event_time (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const adminUsername = String(process.env.SUPER_ADMIN_USERNAME || '').trim();
  if (adminUsername) {
    await db.query("UPDATE app_user SET role = 'super_admin' WHERE username = ?", [adminUsername]);
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 64);
  return String(req.socket?.remoteAddress || '').slice(0, 64);
}

async function logAuthEvent(db, req, { userId = null, username, eventType }) {
  await db.query(`
    INSERT INTO auth_events
      (user_id, username_snapshot, event_type, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `, [
    userId,
    String(username || 'unknown').slice(0, 120),
    eventType,
    getClientIp(req),
    String(req.headers['user-agent'] || '').slice(0, 500) || null,
  ]);
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({success: false, message: '请先登录'});
    }
    if (req.session.user.role !== role) {
      return res.status(403).json({success: false, message: '没有权限访问该资源'});
    }
    next();
  };
}

module.exports = {
  ensureAuthSchema,
  logAuthEvent,
  requireRole,
};
