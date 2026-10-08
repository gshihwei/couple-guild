# Couple Guild V0.5.2 — Live Actor Layer

## 目標
把 V0.5.0 的 Sprite Layer 從「可移動貼圖」提升成真正有 RPG 空間感的角色層。

## 本版完成
- 玩家、另一半、其他線上玩家、飛飛、呼呼統一進入 actor render layer
- 依 Y 座標動態排序，角色可自然前後交錯
- 遠端玩家與另一半位置平滑插值，降低 Realtime 抖動
- 玩家／隊友增加 RPG 名牌與線上狀態點
- 玩家與 NPC/貓咪使用獨立接地陰影
- 角色待機呼吸、移動腳步 bob
- 貓咪保留玩耍／睡覺／互動動畫
- 保留 V0.5.1 強制橫向策略
- 保留 Supabase、多人成員同步、任務與貓咪互動
- Service Worker cache 升版避免舊版素材殘留

## 測試
- `npm run check`
- `npm run build`

## Git
`feat: polish live actor layer for v0.5.2`
