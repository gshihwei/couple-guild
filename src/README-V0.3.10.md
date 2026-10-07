# Couple Guild V0.3.10 — RPG HUD Visual Foundation

V0.3.10 專注於把現有多人 RPG 世界的操作介面從「管理工具感」往「手機 RPG」方向整理，同時維持 V0.3.9 的 Supabase、多人、公會、任務與通知功能。

## 本版完成

- RPG 風格玩家／公會 HUD
- 玩家名稱與公會名稱動態顯示
- 公會等級與 XP 進度條
- Gold / XP / 貓罐頭資源列
- 目前冒險／任務追蹤卡
- Supabase 線上／本機狀態指示
- 靠近可互動物件時的底部互動提示
- 手機 Landscape HUD 響應式整理
- 底部導航重新整理為更接近遊戲快捷列
- Service Worker cache 升版至 V0.3.10，避免舊版快取卡住

## 保留功能

- Supabase 自動設定
- 公會建立／加入
- 多人 Realtime
- 多成員同步
- 任務接受／完成／獎勵
- 通知中心
- 公會之家
- 飛飛／呼呼
- Landscape-first PWA

## Build / Check

```bash
npm run check
npm run build
```

Render Static Site：

```text
Build Command: npm run build
Publish Directory: dist
```
