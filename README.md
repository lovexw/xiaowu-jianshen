# 小吴乐意 · 健身打卡

> 2025-08-21 ~ 2027-04-01 健身打卡记录应用

## 功能

- 🔐 密码登录（简单认证）
- 📋 每日打卡：游泳 🏊、跑步机 🏃、力量训练 🏋️
- ⏱️ 时长记录：0.5h 为节点
- 📊 仪表盘：累计天数、运动时长、连续打卡
- 🔥 GitHub 风格热力图
- 📈 项目统计与打卡进度

## 技术栈

- **前端**：单页 HTML（内嵌 CSS/JS），明亮现代风格
- **后端**：Cloudflare Workers
- **存储**：Cloudflare KV
- **部署**：Cloudflare Workers

## 本地开发

```bash
npm install
npx wrangler kv namespace create CHECKIN_KV
# 将返回的 id 填入 wrangler.toml
npx wrangler dev
```

## 部署

```bash
npx wrangler deploy
```

## 数据结构

KV key: `checkin:YYYY-MM-DD`
KV value:
```json
{
  "date": "2025-08-28",
  "exercises": [
    { "id": "swim", "duration": 1 },
    { "id": "strength", "duration": 0.5 }
  ],
  "ts": 1234567890
}
```

## 修改密码

编辑 `src/worker.js` 中的 `APP_PASSWORD` 常量。
