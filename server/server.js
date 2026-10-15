const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const {
    answerAgentQuery,
    ensureKnowledgeSchema,
    listKnowledge,
    safeJsonParse
} = require('./knowledge-service');
const {ensureAuthSchema, logAuthEvent, requireRole} = require('./auth-service');

const fs = require('fs');
const dbConfig = require('./db-config');

const app = express();
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = String(process.env.SESSION_SECRET || '');

if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET 必须通过环境变量提供，并且长度不能少于 32 个字符');
}

if (isProduction) {
    app.set('trust proxy', 1);
}

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge:  24 * 60 * 60 * 1000
    }
}));

const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, 'uploads');
const bundledUploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {recursive: true});
}
// 新上传的图片优先从持久化目录读取；旧版本随源码保存的图片作为兼容回退。
app.use('/uploads', express.static(uploadDir, {maxAge: isProduction ? '7d' : 0}));
if (path.resolve(uploadDir) !== path.resolve(bundledUploadDir)) {
    app.use('/uploads', express.static(bundledUploadDir, {maxAge: isProduction ? '7d' : 0}));
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) =>{
        const extensions = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif'
        };
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extensions[file.mimetype] || '.jpg'}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {fileSize: 10 * 1024 * 1024},
    fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            return cb(new Error('仅支持 JPG、PNG、WebP 或 GIF 图片'));
        }
        cb(null, true);
    }
});

const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const extensions = {
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/x-wav': '.wav',
            'audio/ogg': '.ogg',
            'audio/mp4': '.m4a',
            'audio/aac': '.aac'
        };
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extensions[file.mimetype] || '.mp3'}`);
    }
});
const audioUpload = multer({
    storage: audioStorage,
    limits: {fileSize: 30 * 1024 * 1024},
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/aac'];
        if (!allowed.includes(file.mimetype)) return cb(new Error('仅支持 MP3、WAV、OGG、M4A 或 AAC 音频'));
        cb(null, true);
    }
});

const db = mysql.createPool(dbConfig);
const defaultMusicTracks = [
    ['城市晚风', 'SoundHelix · 夜行片段', '城市', '06:12', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', '#425b70', '#e5a15d'],
    ['沿海公路', 'SoundHelix · 旅途声景', '旅行', '05:31', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', '#3e8b91', '#eed59d'],
    ['雨停以后', 'SoundHelix · 安静时刻', '治愈', '05:03', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', '#687c98', '#d8d3e8'],
    ['山野来信', 'SoundHelix · 自然漫游', '自然', '04:46', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', '#4b7966', '#d4b77d'],
    ['午后留白', 'SoundHelix · 咖啡时间', '治愈', '05:24', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', '#8a6656', '#e8c99d'],
    ['星空慢行', 'SoundHelix · 深夜收藏', '城市', '05:15', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', '#363c69', '#b88bb8']
];

async function ensureMusicSchema() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS music_tracks (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            title VARCHAR(120) NOT NULL,
            artist VARCHAR(180) NOT NULL DEFAULT '',
            theme VARCHAR(40) NOT NULL DEFAULT '其他',
            duration_label VARCHAR(20) NOT NULL DEFAULT '--:--',
            audio_url VARCHAR(600) NOT NULL,
            color_a VARCHAR(20) NOT NULL DEFAULT '#425b70',
            color_b VARCHAR(20) NOT NULL DEFAULT '#e5a15d',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_music_user_time (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
}

async function seedMusicForUser(userId) {
    const [[userRow]] = await db.query('SELECT music_initialized FROM app_user WHERE id = ?', [userId]);
    if (!userRow || Number(userRow.music_initialized) === 1) return;
    await db.query(`
        INSERT INTO music_tracks (user_id, title, artist, theme, duration_label, audio_url, color_a, color_b)
        VALUES ${defaultMusicTracks.map(() => '(?,?,?,?,?,?,?,?)').join(',')}
    `, defaultMusicTracks.flatMap((track) => [userId, ...track]));
    await db.query('UPDATE app_user SET music_initialized = 1 WHERE id = ?', [userId]);
}

const serializeMusicTrack = (row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    theme: row.theme,
    duration: row.duration_label,
    url: row.audio_url,
    colors: [row.color_a, row.color_b]
});
function checkLogin(req, res, next){
    if(!req.session.user){
        return res.status(401).json({success: false, message: '未登录，请先登录'});
    }
    next();
}

app.post('/api/register', async (req, res) => { 
    try {
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');
        const email = String(req.body?.email || '').trim().toLowerCase();
        const birthday = String(req.body?.birthday || '').trim();
        if (username.length < 2 || username.length > 40) {
            return res.status(400).json({success: false, message: '用户名需为 2 至 40 个字符'});
        }
        if (password.length < 6 || password.length > 72) {
            return res.status(400).json({success: false, message: '密码需为 6 至 72 个字符'});
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({success: false, message: '请输入有效的邮箱地址'});
        }
        if (birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday > new Date().toISOString().slice(0, 10))) {
            return res.status(400).json({success: false, message: '请输入有效的生日'});
        }
        const hashPwd = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            "INSERT INTO app_user(username,password,email,birthday,role) values(?,?,?,?,'user')",
            [username, hashPwd, email || null, birthday || null]
        );
        await logAuthEvent(db, req, {userId: result.insertId, username, eventType: 'REGISTER'});
        res.json({success: true, message: '注册成功', userId: result.insertId});
    }catch (error) {
        console.error(error);
        const duplicate = error.code === 'ER_DUP_ENTRY';
        res.status(duplicate ? 409 : 500).json({success: false, message: duplicate ? '用户名已存在' : '注册失败'});
    }
});

app.post('/api/login', async (req, res) => {
    try{
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');
        const [rows] = await db.query(`
            SELECT id, username, password, role, email, avatar_url, signature_text,
                   DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday
            FROM app_user WHERE username = ?
        `, [username]);
        if(rows.length === 0){
            await logAuthEvent(db, req, {username, eventType: 'LOGIN_FAILED'});
            return res.json({success: false, message: '用户不存在'});
        }
        const user = rows[0];
        const ok =await bcrypt.compare(password, user.password);
        if(!ok) {
            await logAuthEvent(db, req, {userId: user.id, username: user.username, eventType: 'LOGIN_FAILED'});
            return res.json({success: false, message: '密码错误'});
        }
        await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role || 'user',
            email: user.email || '',
            birthday: user.birthday || '',
            avatarUrl: user.avatar_url || '',
            signature: user.signature_text || ''
        };
        await db.query('UPDATE app_user SET last_login_at = NOW() WHERE id = ?', [user.id]);
        await logAuthEvent(db, req, {userId: user.id, username: user.username, eventType: 'LOGIN_SUCCESS'});
        res.json({success: true, message: '登录成功', user: req.session.user});  
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: '登录失败'});
    }
});

app.get('/api/get-user', async (req, res)=>{
    if(!req.session.user) return res.json({isLogin: false});
    try {
        const [rows] = await db.query(`
            SELECT id, username, role, email, avatar_url, signature_text,
                   DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday
            FROM app_user WHERE id = ?
        `, [req.session.user.id]);
        if (!rows.length) return res.json({isLogin: false});
        req.session.user = {
            id: rows[0].id,
            username: rows[0].username,
            role: rows[0].role,
            email: rows[0].email || '',
            birthday: rows[0].birthday || '',
            avatarUrl: rows[0].avatar_url || '',
            signature: rows[0].signature_text || ''
        };
        res.json({isLogin: true, user: req.session.user});
    } catch (error) {
        console.error('账号信息加载失败', error);
        res.status(500).json({success: false, message: '账号信息加载失败'});
    }
});

app.put('/api/profile', checkLogin, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const birthday = String(req.body?.birthday || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({success: false, message: '请输入有效的邮箱地址'});
    }
    if (birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday > new Date().toISOString().slice(0, 10))) {
        return res.status(400).json({success: false, message: '请输入有效的生日'});
    }
    try {
        await db.query('UPDATE app_user SET email = ?, birthday = ? WHERE id = ?', [email || null, birthday || null, req.session.user.id]);
        req.session.user = {...req.session.user, email, birthday};
        res.json({success: true, user: req.session.user});
    } catch (error) {
        console.error('个人资料保存失败', error);
        res.status(500).json({success: false, message: '个人资料保存失败'});
    }
});

const saveProfileSignature = async (req, res) => {
    const signature = String(req.body?.signature || '').trim();
    if (!signature) {
        return res.status(400).json({success: false, message: '请输入个性签名'});
    }
    if (signature.length > 120) {
        return res.status(400).json({success: false, message: '个性签名不能超过 120 个字符'});
    }
    try {
        await db.query('UPDATE app_user SET signature_text = ? WHERE id = ?', [signature, req.session.user.id]);
        req.session.user = {...req.session.user, signature};
        res.json({success: true, signature, user: req.session.user});
    } catch (error) {
        console.error('个性签名保存失败', error);
        res.status(500).json({success: false, message: '个性签名保存失败'});
    }
};

app.get('/api/profile/signature', checkLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT signature_text FROM app_user WHERE id = ?', [req.session.user.id]);
        if (!rows.length) return res.status(404).json({success: false, message: '没有找到该账号'});
        res.json({success: true, signature: rows[0].signature_text || ''});
    } catch (error) {
        console.error('个性签名加载失败', error);
        res.status(500).json({success: false, message: '个性签名加载失败'});
    }
});

app.post('/api/profile/signature', checkLogin, saveProfileSignature);
app.put('/api/profile/signature', checkLogin, saveProfileSignature);

app.delete('/api/profile/signature', checkLogin, async (req, res) => {
    try {
        await db.query('UPDATE app_user SET signature_text = NULL WHERE id = ?', [req.session.user.id]);
        req.session.user = {...req.session.user, signature: ''};
        res.json({success: true, signature: '', user: req.session.user});
    } catch (error) {
        console.error('个性签名删除失败', error);
        res.status(500).json({success: false, message: '个性签名删除失败'});
    }
});

app.post('/api/profile/avatar', checkLogin, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({success: false, message: '请选择头像图片'});
    try {
        const [rows] = await db.query('SELECT avatar_url FROM app_user WHERE id = ?', [req.session.user.id]);
        const avatarUrl = `/uploads/${req.file.filename.trim()}`;
        await db.query('UPDATE app_user SET avatar_url = ? WHERE id = ?', [avatarUrl, req.session.user.id]);
        const previousUrl = rows[0]?.avatar_url;
        if (previousUrl) {
            const previousPath = path.join(uploadDir, path.basename(previousUrl));
            if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
        }
        req.session.user = {...req.session.user, avatarUrl};
        res.json({success: true, avatarUrl, user: req.session.user});
    } catch (error) {
        if (req.file) {
            const uploadedPath = path.join(uploadDir, req.file.filename);
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        }
        console.error('头像上传失败', error);
        res.status(500).json({success: false, message: '头像上传失败'});
    }
});

app.put('/api/profile/password', checkLogin, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6 || newPassword.length > 72) {
        return res.status(400).json({success: false, message: '新密码需为 6 至 72 个字符'});
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({success: false, message: '新密码不能与当前密码相同'});
    }
    try {
        const [rows] = await db.query('SELECT password FROM app_user WHERE id = ?', [req.session.user.id]);
        if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password))) {
            return res.status(400).json({success: false, message: '当前密码不正确'});
        }
        const hashPwd = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE app_user SET password = ? WHERE id = ?', [hashPwd, req.session.user.id]);
        await logAuthEvent(db, req, {
            userId: req.session.user.id,
            username: req.session.user.username,
            eventType: 'PASSWORD_CHANGE'
        });
        res.json({success: true, message: '密码修改成功'});
    } catch (error) {
        console.error('密码修改失败', error);
        res.status(500).json({success: false, message: '密码修改失败'});
    }
});

app.get('/api/auth/me/events', checkLogin, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, event_type, ip_address, user_agent, created_at
            FROM auth_events
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 30
        `, [req.session.user.id]);
        res.json({success: true, events: rows});
    } catch (error) {
        console.error('个人登录记录加载失败', error);
        res.status(500).json({success: false, message: '登录记录加载失败'});
    }
});

app.get('/api/admin/summary', requireRole('super_admin'), async (req, res) => {
    try {
        const [[userStats], [todayStats], [contentStats], [recentUsers], [recentMemories]] = await Promise.all([
            db.query(`
                SELECT COUNT(*) AS totalUsers,
                       SUM(role = 'super_admin') AS adminUsers,
                       SUM(last_login_at IS NOT NULL) AS activeUsers
                FROM app_user
            `),
            db.query(`
                SELECT SUM(event_type = 'REGISTER') AS registrationsToday,
                       SUM(event_type = 'LOGIN_SUCCESS') AS loginsToday,
                       SUM(event_type = 'LOGIN_FAILED') AS failedToday
                FROM auth_events
                WHERE created_at >= CURDATE()
            `),
            db.query(`
                SELECT
                  (SELECT COUNT(*) FROM memories) AS memories,
                  (SELECT COUNT(*) FROM memories WHERE imgSrc IS NOT NULL AND imgSrc <> '') AS photos,
                  (SELECT COUNT(*) FROM music_tracks) AS musicTracks,
                  (SELECT COUNT(*) FROM knowledge_entries) AS knowledgeEntries,
                  (SELECT COUNT(*) FROM knowledge_entries WHERE is_active = 1) AS activeKnowledge,
                  (SELECT COUNT(*) FROM agent_messages) AS agentMessages,
                  (SELECT COUNT(*) FROM auth_events) AS authEvents
            `),
            db.query(`
                SELECT id, username, role, created_at
                FROM app_user
                ORDER BY id DESC
                LIMIT 5
            `),
            db.query(`
                SELECT m.id, m.title, m.mood, m.imgSrc, u.username
                FROM memories m
                LEFT JOIN app_user u ON u.id = m.user_id
                ORDER BY m.id DESC
                LIMIT 5
            `)
        ]);
        res.json({
            success: true,
            summary: {...userStats[0], ...todayStats[0], ...contentStats[0]},
            recentUsers,
            recentMemories,
            tables: [
                {key: 'users', label: '账号数据', table: 'app_user', count: userStats[0].totalUsers},
                {key: 'memories', label: '记忆坐标', table: 'memories', count: contentStats[0].memories},
                {key: 'music', label: '音乐内容', table: 'music_tracks', count: contentStats[0].musicTracks},
                {key: 'knowledge', label: '知识条目', table: 'knowledge_entries', count: contentStats[0].knowledgeEntries},
                {key: 'agent', label: 'Agent 对话', table: 'agent_messages', count: contentStats[0].agentMessages},
                {key: 'events', label: '认证审计', table: 'auth_events', count: contentStats[0].authEvents}
            ]
        });
    } catch (error) {
        console.error('管理员统计加载失败', error);
        res.status(500).json({success: false, message: '管理员统计加载失败'});
    }
});

app.get('/api/admin/users', requireRole('super_admin'), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.id, u.username, u.role, u.email,
                   DATE_FORMAT(u.birthday, '%Y-%m-%d') AS birthday,
                   u.created_at, u.last_login_at,
                   (SELECT COUNT(*) FROM memories m WHERE m.user_id = u.id) AS memory_count,
                   (SELECT COUNT(*) FROM music_tracks t WHERE t.user_id = u.id) AS music_count,
                   (SELECT COUNT(*) FROM agent_messages a WHERE a.user_id = u.id) AS agent_message_count,
                   (SELECT COUNT(*) FROM auth_events e WHERE e.user_id = u.id AND e.event_type = 'LOGIN_SUCCESS') AS login_count
            FROM app_user u
            ORDER BY u.id DESC
            LIMIT 300
        `);
        res.json({success: true, users: rows});
    } catch (error) {
        console.error('用户列表加载失败', error);
        res.status(500).json({success: false, message: '用户列表加载失败'});
    }
});

app.patch('/api/admin/users/:id/role', requireRole('super_admin'), async (req, res) => {
    const targetId = Number(req.params.id);
    const role = String(req.body?.role || '');
    if (!Number.isInteger(targetId) || !['user', 'super_admin'].includes(role)) {
        return res.status(400).json({success: false, message: '角色参数无效'});
    }
    if (targetId === Number(req.session.user.id)) {
        return res.status(400).json({success: false, message: '不能修改当前登录管理员自己的角色'});
    }
    try {
        const [[target]] = await db.query('SELECT id, username, role FROM app_user WHERE id = ?', [targetId]);
        if (!target) return res.status(404).json({success: false, message: '没有找到该账号'});
        if (target.role === 'super_admin' && role === 'user') {
            const [[adminCount]] = await db.query("SELECT COUNT(*) AS count FROM app_user WHERE role = 'super_admin'");
            if (Number(adminCount.count) <= 1) {
                return res.status(400).json({success: false, message: '必须至少保留一名超级管理员'});
            }
        }
        await db.query('UPDATE app_user SET role = ? WHERE id = ?', [role, targetId]);
        await logAuthEvent(db, req, {
            userId: req.session.user.id,
            username: req.session.user.username,
            eventType: role === 'super_admin' ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED'
        });
        res.json({success: true, user: {...target, role}});
    } catch (error) {
        console.error('用户角色更新失败', error);
        res.status(500).json({success: false, message: '用户角色更新失败'});
    }
});

app.delete('/api/admin/users/:id', requireRole('super_admin'), async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) return res.status(400).json({success: false, message: '用户编号无效'});
    if (targetId === Number(req.session.user.id)) {
        return res.status(400).json({success: false, message: '不能删除当前登录的管理员账号'});
    }

    const connection = await db.getConnection();
    let mediaUrls = [];
    try {
        await connection.beginTransaction();
        const [[target]] = await connection.query('SELECT id, username, role, avatar_url FROM app_user WHERE id = ? FOR UPDATE', [targetId]);
        if (!target) {
            await connection.rollback();
            return res.status(404).json({success: false, message: '没有找到该账号'});
        }
        if (target.role === 'super_admin') {
            const [[adminCount]] = await connection.query("SELECT COUNT(*) AS count FROM app_user WHERE role = 'super_admin'");
            if (Number(adminCount.count) <= 1) {
                await connection.rollback();
                return res.status(400).json({success: false, message: '必须至少保留一名超级管理员'});
            }
        }
        const [memoryMedia] = await connection.query('SELECT imgSrc AS url FROM memories WHERE user_id = ?', [targetId]);
        const [musicMedia] = await connection.query("SELECT audio_url AS url FROM music_tracks WHERE user_id = ? AND audio_url LIKE '/uploads/%'", [targetId]);
        mediaUrls = [target.avatar_url, ...memoryMedia.map((item) => item.url), ...musicMedia.map((item) => item.url)].filter(Boolean);
        await connection.query('DELETE FROM memories WHERE user_id = ?', [targetId]);
        await connection.query('DELETE FROM music_tracks WHERE user_id = ?', [targetId]);
        await connection.query('DELETE FROM agent_messages WHERE user_id = ?', [targetId]);
        await connection.query('DELETE FROM auth_events WHERE user_id = ?', [targetId]);
        await connection.query('DELETE FROM app_user WHERE id = ?', [targetId]);
        await connection.commit();
        mediaUrls.forEach((mediaUrl) => {
            if (!String(mediaUrl).startsWith('/uploads/')) return;
            const mediaPath = path.join(uploadDir, path.basename(mediaUrl));
            if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
        });
        res.json({success: true});
    } catch (error) {
        await connection.rollback();
        console.error('用户删除失败', error);
        res.status(500).json({success: false, message: '用户删除失败'});
    } finally {
        connection.release();
    }
});

const adminDataQueries = {
    memories: `
        SELECT m.id, m.user_id, u.username, m.title, m.mood, m.lat, m.lng, m.imgSrc
        FROM memories m LEFT JOIN app_user u ON u.id = m.user_id
        ORDER BY m.id DESC LIMIT ?
    `,
    music: `
        SELECT t.id, t.user_id, u.username, t.title, t.artist, t.theme,
               t.duration_label, t.audio_url, t.created_at
        FROM music_tracks t LEFT JOIN app_user u ON u.id = t.user_id
        ORDER BY t.id DESC LIMIT ?
    `,
    knowledge: `
        SELECT id, slug, category, title, summary, source_label, is_active, updated_at
        FROM knowledge_entries ORDER BY id DESC LIMIT ?
    `,
    agent: `
        SELECT a.id, a.user_id, u.username, a.role,
               LEFT(a.content, 500) AS content, a.created_at
        FROM agent_messages a LEFT JOIN app_user u ON u.id = a.user_id
        ORDER BY a.id DESC LIMIT ?
    `
};

app.get('/api/admin/data/:type', requireRole('super_admin'), async (req, res) => {
    const type = String(req.params.type || '');
    const query = adminDataQueries[type];
    if (!query) return res.status(404).json({success: false, message: '不支持的数据类型'});
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    try {
        const [rows] = await db.query(query, [limit]);
        res.json({success: true, type, rows});
    } catch (error) {
        console.error('数据库内容加载失败', error);
        res.status(500).json({success: false, message: '数据库内容加载失败'});
    }
});

app.patch('/api/admin/knowledge/:id', requireRole('super_admin'), async (req, res) => {
    const id = Number(req.params.id);
    const isActive = req.body?.isActive === true ? 1 : req.body?.isActive === false ? 0 : null;
    if (!Number.isInteger(id) || isActive === null) {
        return res.status(400).json({success: false, message: '知识条目参数无效'});
    }
    try {
        const [result] = await db.query('UPDATE knowledge_entries SET is_active = ? WHERE id = ?', [isActive, id]);
        if (!result.affectedRows) return res.status(404).json({success: false, message: '没有找到该知识条目'});
        res.json({success: true});
    } catch (error) {
        console.error('知识条目状态更新失败', error);
        res.status(500).json({success: false, message: '知识条目状态更新失败'});
    }
});

app.delete('/api/admin/data/:type/:id', requireRole('super_admin'), async (req, res) => {
    const type = String(req.params.type || '');
    const id = Number(req.params.id);
    const deleteConfig = {
        memories: {table: 'memories', mediaColumn: 'imgSrc'},
        music: {table: 'music_tracks', mediaColumn: 'audio_url'},
        agent: {table: 'agent_messages', mediaColumn: null}
    }[type];
    if (!deleteConfig || !Number.isInteger(id)) {
        return res.status(400).json({success: false, message: '删除参数无效'});
    }
    try {
        let mediaUrl = '';
        if (deleteConfig.mediaColumn) {
            const [rows] = await db.query(`SELECT ${deleteConfig.mediaColumn} AS mediaUrl FROM ${deleteConfig.table} WHERE id = ?`, [id]);
            if (!rows.length) return res.status(404).json({success: false, message: '没有找到该记录'});
            mediaUrl = rows[0].mediaUrl || '';
        }
        const [result] = await db.query(`DELETE FROM ${deleteConfig.table} WHERE id = ?`, [id]);
        if (!result.affectedRows) return res.status(404).json({success: false, message: '没有找到该记录'});
        if (String(mediaUrl).startsWith('/uploads/')) {
            const mediaPath = path.join(uploadDir, path.basename(mediaUrl));
            if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
        }
        res.json({success: true});
    } catch (error) {
        console.error('数据库记录删除失败', error);
        res.status(500).json({success: false, message: '数据库记录删除失败'});
    }
});

app.get('/api/admin/auth-events', requireRole('super_admin'), async (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit) || 100;
        const limit = Math.min(Math.max(requestedLimit, 1), 300);
        const [rows] = await db.query(`
            SELECT e.id, e.user_id, e.username_snapshot AS username, e.event_type,
                   e.ip_address, e.user_agent, e.created_at, u.role
            FROM auth_events e
            LEFT JOIN app_user u ON u.id = e.user_id
            ORDER BY e.id DESC
            LIMIT ?
        `, [limit]);
        res.json({success: true, events: rows});
    } catch (error) {
        console.error('认证日志加载失败', error);
        res.status(500).json({success: false, message: '认证日志加载失败'});
    }
});

app.get('/api/knowledge', checkLogin, async (req, res) => {
    try {
        const entries = await listKnowledge(db);
        const categories = [...new Set(entries.map(entry => entry.category))];
        res.json({success: true, entries, categories, total: entries.length});
    } catch (error) {
        console.error('知识库加载失败', error);
        res.status(500).json({success: false, message: '知识库加载失败'});
    }
});

app.get('/api/agent/history', checkLogin, async (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit) || 30;
        const limit = Math.min(Math.max(requestedLimit, 1), 100);
        const [rows] = await db.query(`
            SELECT id, role, content, sources_json, created_at
            FROM agent_messages
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        `, [req.session.user.id, limit]);
        const messages = rows.reverse().map(row => ({
            id: row.id,
            role: row.role === 'assistant' ? 'agent' : 'user',
            text: row.content,
            sources: safeJsonParse(row.sources_json),
            createdAt: row.created_at
        }));
        res.json({success: true, messages});
    } catch (error) {
        console.error('对话历史加载失败', error);
        res.status(500).json({success: false, message: '对话历史加载失败'});
    }
});

app.delete('/api/agent/history', checkLogin, async (req, res) => {
    try {
        await db.query('DELETE FROM agent_messages WHERE user_id = ?', [req.session.user.id]);
        res.json({success: true});
    } catch (error) {
        console.error('清空对话失败', error);
        res.status(500).json({success: false, message: '清空对话失败'});
    }
});

app.post('/api/agent/query', checkLogin, async (req, res) => {
    try {
        const query = String(req.body?.query || '').trim();
        if (!query) return res.status(400).json({success: false, message: '请输入问题'});
        if (query.length > 500) return res.status(400).json({success: false, message: '问题不能超过 500 字'});
        const result = await answerAgentQuery(db, req.session.user.id, query);
        res.json({success: true, ...result});
    } catch (error) {
        console.error('Agent 回答失败', error);
        res.status(500).json({success: false, message: 'Agent 暂时无法回答，请稍后重试'});
    }
});

app.post( '/api/logout', async (req, res) => {
    const currentUser = req.session.user;
    if (currentUser) {
        await logAuthEvent(db, req, {userId: currentUser.id, username: currentUser.username, eventType: 'LOGOUT'}).catch(console.error);
    }
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({success: true, message: '已退出登录'});
    });
});


app.get('/api/memories', checkLogin, async (req, res) => { 
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query('SELECT * FROM memories WHERE user_id= ?',[userId]) ;
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: '查询失败'});
  }
});

app.post('/api/memories', checkLogin, upload.single('file'), async (req, res) => {
  try {
    const { lat, lng, title, mood } = req.body;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
      return res.status(400).json({success: false, error: '地点坐标无效'});
    }
    const imgSrc = req.file ? `/uploads/${req.file.filename.trim()}` : null;
    const userId = req.session.user.id; 
    const sql = 'INSERT INTO memories (lat, lng, title, mood, imgSrc, user_id) VALUES (?,?,?,?,?,?)';
    const [result] = await db.query(sql, [parsedLat, parsedLng, String(title || '').trim(), String(mood || '').trim(), imgSrc, userId]);
    res.json({ success: true, id: result.insertId, imgSrc });
  } catch (err) {
    console.error('【保存报错】', err);
    res.status(500).json({ error: '保存失败' });
  }
})




app.put('/api/memories/:id', checkLogin, upload.single('file'), async (req, res) =>{
    try{
        const userId = req.session.user.id;
        const { id } = req.params;
        const { lat, lng, title, mood } = req.body;
        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
            return res.status(400).json({success: false, message: '地点坐标无效'});
        }
        const [ownedRows] = await db.query('SELECT imgSrc FROM memories WHERE id = ? AND user_id = ?', [id, userId]);
        if (!ownedRows.length) return res.status(404).json({success: false, message: '没有找到这条记忆'});
        let imgSrc = null;
        if(req.file){
            imgSrc = `/uploads/${req.file.filename.trim()}`;
            await db.query('UPDATE memories SET lat=?,lng=?,title=?,mood=?,imgSrc=? WHERE id=? and user_id =?', [parsedLat,parsedLng,String(title || '').trim(),String(mood || '').trim(),imgSrc,id,userId]);
            const previousPath = ownedRows[0].imgSrc && path.join(uploadDir, path.basename(ownedRows[0].imgSrc));
            if (previousPath && fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
        } else{
            await db.query('UPDATE memories SET lat=?,lng=?,title=?,mood=? WHERE id=? and user_id=?', [parsedLat,parsedLng,String(title || '').trim(),String(mood || '').trim(),id,userId]);
        }
        res.json({success: true, imgSrc: imgSrc || ownedRows[0].imgSrc});
    }catch(error){
        console.error(error);
        res.status(500).json({success: false, message: '更新失败'});
    }
}
);


app.delete('/api/memories/:id',  checkLogin, async (req, res)=>{
  try {
    const userId = req.session.user.id;
    const id = req.params.id;
    const [rows] = await db.query('select *from memories where id= ? and user_id = ?', [id, userId]);
    if(rows.length === 0){
      return res.status(403).json({success: false, message: '无权删除这条记录'});
    }
    const memory = rows[0];
    if(memory?.imgSrc){
      const filePath = path.join(uploadDir, path.basename(memory.imgSrc));
      if(fs.existsSync(filePath)){
        fs.unlinkSync(filePath);
      }
    }
    await db.query('DELETE FROM memories WHERE id = ? and user_id=?' ,[id, userId]);
    res.json({success: true, message: '删除成功'});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: '删除失败'});
  }
});

// 构建后由后端提供前端页面，浏览器、API 和 Session 保持同源。
const frontendDist = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const musicPalettes = {
    '城市': ['#425b70', '#e5a15d'],
    '旅行': ['#3e8b91', '#eed59d'],
    '治愈': ['#687c98', '#d8d3e8'],
    '自然': ['#4b7966', '#d4b77d'],
    '其他': ['#655b83', '#c69ac8']
};
const removeUploadedMedia = (mediaUrl) => {
    if (!String(mediaUrl || '').startsWith('/uploads/')) return;
    const mediaPath = path.join(uploadDir, path.basename(mediaUrl));
    if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
};

app.get('/api/music', checkLogin, async (req, res) => {
    try {
        await seedMusicForUser(req.session.user.id);
        const [rows] = await db.query('SELECT * FROM music_tracks WHERE user_id = ? ORDER BY id ASC', [req.session.user.id]);
        res.json({success: true, tracks: rows.map(serializeMusicTrack)});
    } catch (error) {
        console.error('音乐列表加载失败', error);
        res.status(500).json({success: false, message: '音乐列表加载失败'});
    }
});

app.post('/api/music', checkLogin, audioUpload.single('audio'), async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const artist = String(req.body?.artist || '').trim();
    const theme = String(req.body?.theme || '其他').trim().slice(0, 40) || '其他';
    const durationLabel = String(req.body?.duration || '--:--').trim().slice(0, 20) || '--:--';
    const externalUrl = String(req.body?.audioUrl || '').trim();
    const audioUrl = req.file ? `/uploads/${req.file.filename}` : externalUrl;
    if (!title || title.length > 120) {
        if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
        return res.status(400).json({success: false, message: '音乐标题需为 1 至 120 个字符'});
    }
    if (!audioUrl || (!audioUrl.startsWith('/uploads/') && !/^https?:\/\//i.test(audioUrl))) {
        if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
        return res.status(400).json({success: false, message: '请上传音频文件或填写有效的音频网址'});
    }
    const colors = musicPalettes[theme] || musicPalettes['其他'];
    try {
        const [result] = await db.query(`
            INSERT INTO music_tracks (user_id, title, artist, theme, duration_label, audio_url, color_a, color_b)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.session.user.id, title, artist.slice(0, 180), theme, durationLabel, audioUrl, colors[0], colors[1]]);
        const [rows] = await db.query('SELECT * FROM music_tracks WHERE id = ? AND user_id = ?', [result.insertId, req.session.user.id]);
        res.json({success: true, track: serializeMusicTrack(rows[0])});
    } catch (error) {
        if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
        console.error('音乐新增失败', error);
        res.status(500).json({success: false, message: '音乐新增失败'});
    }
});

app.put('/api/music/:id', checkLogin, audioUpload.single('audio'), async (req, res) => {
    try {
        const [ownedRows] = await db.query('SELECT * FROM music_tracks WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
        if (!ownedRows.length) {
            if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
            return res.status(404).json({success: false, message: '没有找到这首音乐'});
        }
        const current = ownedRows[0];
        const title = String(req.body?.title || '').trim();
        const artist = String(req.body?.artist || '').trim();
        const theme = String(req.body?.theme || '其他').trim().slice(0, 40) || '其他';
        const durationLabel = String(req.body?.duration || '--:--').trim().slice(0, 20) || '--:--';
        const externalUrl = String(req.body?.audioUrl || '').trim();
        const audioUrl = req.file ? `/uploads/${req.file.filename}` : (externalUrl || current.audio_url);
        if (!title || title.length > 120 || (!audioUrl.startsWith('/uploads/') && !/^https?:\/\//i.test(audioUrl))) {
            if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
            return res.status(400).json({success: false, message: '音乐信息不完整'});
        }
        const colors = musicPalettes[theme] || musicPalettes['其他'];
        await db.query(`
            UPDATE music_tracks SET title = ?, artist = ?, theme = ?, duration_label = ?, audio_url = ?, color_a = ?, color_b = ?
            WHERE id = ? AND user_id = ?
        `, [title, artist.slice(0, 180), theme, durationLabel, audioUrl, colors[0], colors[1], req.params.id, req.session.user.id]);
        if (req.file && current.audio_url !== audioUrl) removeUploadedMedia(current.audio_url);
        const [rows] = await db.query('SELECT * FROM music_tracks WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
        res.json({success: true, track: serializeMusicTrack(rows[0])});
    } catch (error) {
        if (req.file) removeUploadedMedia(`/uploads/${req.file.filename}`);
        console.error('音乐更新失败', error);
        res.status(500).json({success: false, message: '音乐更新失败'});
    }
});

app.delete('/api/music/:id', checkLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT audio_url FROM music_tracks WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
        if (!rows.length) return res.status(404).json({success: false, message: '没有找到这首音乐'});
        await db.query('DELETE FROM music_tracks WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
        removeUploadedMedia(rows[0].audio_url);
        res.json({success: true});
    } catch (error) {
        console.error('音乐删除失败', error);
        res.status(500).json({success: false, message: '音乐删除失败'});
    }
});

app.get('/api/geocode', checkLogin, async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (query.length < 2 || query.length > 100) {
        return res.status(400).json({success: false, message: '请输入 2 至 100 个字符的地点'});
    }

    try {
        const params = new URLSearchParams({
            q: query,
            format: 'jsonv2',
            addressdetails: '1',
            limit: '6',
            'accept-language': 'zh-CN'
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'User-Agent': 'memory-map/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Geocoding responded with ${response.status}`);
        const data = await response.json();
        res.set('Cache-Control', 'private, max-age=300');
        res.json(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error('地点搜索失败', error);
        res.status(502).json({success: false, message: '地点搜索服务暂时不可用，请稍后重试'});
    }
});

app.get('/api/map/tiles/:z/:x/:y.png', checkLogin, async (req, res) => {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0) {
        return res.status(400).end();
    }

    const sources = [
        `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
    ];
    for (const source of sources) {
        try {
            const response = await fetch(source, {
                headers: {'User-Agent': 'memory-map/1.0'},
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) continue;
            const body = Buffer.from(await response.arrayBuffer());
            res.set({
                'Content-Type': response.headers.get('content-type') || 'image/png',
                'Cache-Control': 'public, max-age=604800, immutable'
            });
            return res.send(body);
        } catch (error) {
            console.warn('地图瓦片源不可用', source, error.message);
        }
    }
    res.status(502).end();
});


async function startServer() {
  try {
    await ensureAuthSchema(db);
    await ensureKnowledgeSchema(db);
    await ensureMusicSchema();
    console.log(`Knowledge base ready: ${require('../knowledge/seed.json').length} entries`);
    app.listen(port, host, () => {
      console.log(`Server is running at http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Database initialization failed', error);
    process.exitCode = 1;
  }
}

startServer();
