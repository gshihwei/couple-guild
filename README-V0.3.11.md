# Couple Guild V0.3.11 — Player Character & Animation

V0.3.11 延續 V0.3.10 HUD，專注玩家角色的 RPG 視覺與移動表現，不改動 Supabase、多人成員同步、任務與通知核心。

## 本版完成

- 四方向角色朝向：上／下／左／右
- 角色放大為更明確的 Q 版 RPG 比例
- 行走腳步動畫與上下起伏
- 正面／側面／背面輪廓差異
- 玩家服裝、膚色與小型冒險者配件
- 玩家／遠端玩家名稱牌
- 遠端玩家線上狀態點
- Remote player 依實際座標變化播放行走動畫
- Service Worker cache 升版至 V0.3.11

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
- V0.3.10 RPG HUD

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
