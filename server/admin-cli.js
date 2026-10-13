const mysql = require('mysql2/promise');
const dbConfig = require('./db-config');

async function main() {
  const username = String(process.argv[2] || '').trim();
  if (!username) {
    console.error('用法：npm run make-admin -- <用户名>');
    process.exitCode = 1;
    return;
  }

  const db = mysql.createPool(dbConfig);
  try {
    const [result] = await db.query("UPDATE app_user SET role = 'super_admin' WHERE username = ?", [username]);
    if (!result.affectedRows) {
      console.error(`未找到用户：${username}`);
      process.exitCode = 1;
      return;
    }
    console.log(`已将 ${username} 设置为超级管理员。请重新登录使权限生效。`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('设置超级管理员失败：', error.message);
  process.exitCode = 1;
});
