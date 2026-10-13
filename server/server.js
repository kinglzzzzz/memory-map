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
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {recursive: true});
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) =>{
        const  ext = path.extname(file.originalname);
        const filename = Date.now() + ext;
        cb(null, filename);
    }
});

const upload = multer({ storage });

const db = mysql.createPool(dbConfig);
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
        if (username.length < 2 || username.length > 40) {
            return res.status(400).json({success: false, message: '用户名需为 2 至 40 个字符'});
        }
        if (password.length < 6 || password.length > 72) {
            return res.status(400).json({success: false, message: '密码需为 6 至 72 个字符'});
        }
        const hashPwd = await bcrypt.hash(password, 10);
        const [result] = await db.query("INSERT INTO app_user(username,password,role) values(?,?,'user')", [username, hashPwd]);
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
        const [rows] = await db.query('SELECT id, username, password, role FROM app_user WHERE username = ?', [username]);
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
        req.session.user = {id: user.id, username: user.username, role: user.role || 'user'};
        await db.query('UPDATE app_user SET last_login_at = NOW() WHERE id = ?', [user.id]);
        await logAuthEvent(db, req, {userId: user.id, username: user.username, eventType: 'LOGIN_SUCCESS'});
        res.json({success: true, message: '登录成功', user: req.session.user});  
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: '登录失败'});
    }
});

app.get('/api/get-user', (req, res)=>{
    if(req.session.user){
        res.json({isLogin: true, user: req.session.user});
    } else{
        res.json({isLogin: false});
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
        const [[userStats], [todayStats]] = await Promise.all([
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
            `)
        ]);
        res.json({success: true, summary: {...userStats[0], ...todayStats[0]}});
    } catch (error) {
        console.error('管理员统计加载失败', error);
        res.status(500).json({success: false, message: '管理员统计加载失败'});
    }
});

app.get('/api/admin/users', requireRole('super_admin'), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.id, u.username, u.role, u.created_at, u.last_login_at,
                   (SELECT COUNT(*) FROM memories m WHERE m.user_id = u.id) AS memory_count,
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

app.post('/api/memories', upload.single('file'), async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({error:'请先登录'});
  }
  try {
    const { lat, lng, title, mood } = req.body;
    const fileName = req.file.filename.trim();
    const imgSrc = `/uploads/${fileName}`;
    const userId = req.session.user.id; 
    const sql = 'INSERT INTO memories (lat, lng, title, mood, imgSrc, user_id) VALUES (?,?,?,?,?,?)';
    const [result] = await db.query(sql, [lat, lng, title, mood, imgSrc, userId]);
    res.json({ success: true, id: result.insertId });
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
        let imgSrc = null;
        if(req.file){
            imgSrc = `/uploads/${req.file.filename.trim()}`;
            await db.query('UPDATE memories SET lat=?,lng=?,title=?,mood=?,imgSrc=? WHERE id=? and user_id =?', [lat,lng,title,mood,imgSrc,id,userId]);
        } else{
            await db.query('UPDATE memories SET lat=?,lng=?,title=?,mood=? WHERE id=? and user_id=?', [lat,lng,title,mood,id,userId]);
        }
        res.json({success: true});
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
      const filePath = path.join(__dirname, memory.imgSrc);
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


async function startServer() {
  try {
    await ensureAuthSchema(db);
    await ensureKnowledgeSchema(db);
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
