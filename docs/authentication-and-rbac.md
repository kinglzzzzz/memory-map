# 登录鉴权与角色权限

本模块参考 GitHub 上 node-casbin 的 RBAC 模型、express-session 的服务端会话模式，以及 OWASP CheatSheetSeries 的最小权限和默认拒绝原则。

## 角色

- `user`：注册时的默认角色。只能访问自己的记忆、相册、Agent 对话与认证记录。
- `super_admin`：可以额外访问管理控制台，查看用户列表和全站注册、登录、登录失败、退出日志。

所有账号使用同一个登录入口和 `/api/login` 接口。登录成功后，前端根据服务端返回的 `role` 自动进入普通首页或超级管理员控制台。

前端是否显示“管理后台”不构成权限控制。所有 `/api/admin/*` 请求都会在服务端通过 `requireRole('super_admin')` 再次验证 session。

## 数据库

服务启动时会为 `app_user` 安全补充以下字段：

- `role`
- `created_at`
- `last_login_at`

同时创建 `auth_events` 表保存认证事件，不保存明文密码或密码哈希副本。

## 设置超级管理员

先注册普通账号，然后在 `server` 目录运行：

```powershell
npm run make-admin -- 用户名
```

设置完成后，该账号需要退出并重新登录，使新角色写入 session。
