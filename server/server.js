const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const fs = require('fs');

const app = express();
const port = 3001;  

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

app.use(session({
    secret: 'memory-map-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge:  24 * 60 * 60 * 1000
    }
}));

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

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

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '20030503lzz@',
    database: 'time_memory_map',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});
function checkLogin(req, res, next){
    if(!req.session.user){
        return res.status(401).json({success: false, message: '未登录，请先登录'});
    }
    next();
}

app.post('/api/register', async (req, res) => { 
    try {
        const { username, password } = req.body;
        const hashPwd = await bcrypt.hash(password, 10);
        const [result] = await db.query('INSERT INTO app_user(username,password) values(?,?) ', [username, hashPwd]);
        res.json({success: true, message: '注册成功', userId: result.insertId});
    }catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: '注册失败,用户名已存在'});
    }
});

app.post('/api/login', async (req, res) => {
    try{
        const { username, password } = req.body;
        const [rows] = await db.query('SELECT * FROM app_user WHERE username = ?', [username]);
        if(rows.length === 0){
            return res.json({success: false, message: '用户不存在'});
        }
        const user = rows[0];
        const ok =await bcrypt.compare(password, user.password);
        if(!ok) return res.json({success: false, message: '密码错误'});
        req.session.user = {id: user.id, username: user.username};
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

app.post( '/api/logout', (req, res) => { 
    req.session.destroy();
    res.json({success: true, message: '已退出登录'});
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


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});