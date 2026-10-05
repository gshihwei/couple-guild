# Couple Guild · 雙人公會

V0.1 vertical slice：
- PWA shell，可作為 iOS / Android / Web 同一套入口
- 2D 中央廣場與公會之家
- 玩家 + 另一半 AI 角色
- 飛飛、呼呼自由移動
- 貓咪設定：花色（6 種）與性格（黏人／調皮／貪吃／慵懶）
- 性格會影響靠近、亂晃、討食與咬人機率
- 摸摸／餵食／玩耍／隨機咬人事件
- 公會任務：發布、接受、完成、Gold / XP
- 商店：貓罐頭、毛線球、小盆栽、下午茶券
- 冒險日誌
- localStorage 儲存進度
- 手機虛擬搖桿、桌機 WASD / 方向鍵
- Service Worker 離線快取

## 本機啟動

需要 Node.js 22+。

```bash
npm start
```

瀏覽器開啟：`http://localhost:5173`

## Build

```bash
npm run build
```

產物在 `dist/`，可部署至任何靜態網站主機。

## V0.2.6 貓咪設定

寵物面板可使用 ⚙️ 調整飛飛／呼呼：花色與性格。設定會儲存在 localStorage，且不需要修改遊戲程式。

## 下一版

V0.3 可接 Supabase：登入、雙人公會、Realtime 任務、跨裝置同步、圖片上傳與通知。


## Render 線上部署

本專案是純靜態 PWA，可用 Render Static Site 部署。

- Build Command: `npm run build`
- Publish Directory: `dist`
- Blueprint: `render.yaml`

部署後 Render 會提供 `*.onrender.com` HTTPS 網址；之後推送到指定 Git branch 可自動重新部署。

### Git 初始設定

```bash
git init
git add .
git commit -m "feat: deploy-ready couple guild v0.1"
git branch -M main
```


## V0.2.6
- Landscape-first gameplay layout
- Mobile portrait shows a rotate-to-landscape prompt
- Landscape HUD / navigation / panels optimized for wider screens
- The game camera shows only the local area around the player


## V0.2.7
- 完整探索 Gameplay Loop：移動 → 靠近 → E 互動 → 任務 / 商店 / 貓咪
- 玩家 4 方向行走與簡易步行動畫
- Camera 平滑跟隨與世界邊界
- 中央廣場、外圍建築與河道碰撞
- NPC 互動提示與公會管家 / 雜貨商
- 委託板可直接開啟任務面板，任務接受 / 完成 / 獎勵維持 localStorage
- 貓咪改為必須靠近才能互動，保留照片 Q 版素材與隨機咬人
- Landscape-first PWA 與 Render build 流程維持不變
