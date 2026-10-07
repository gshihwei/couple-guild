# Couple Guild V0.5.1

## 強制橫向遊玩（無提示）

- 移除手機直立時的「請橫向遊玩」遮罩與提示。
- PWA manifest 保持 `orientation: landscape`。
- 支援 Screen Orientation API 時，啟動與首次觸控會嘗試鎖定 landscape。
- 不支援原生 orientation lock 的瀏覽器，使用 CSS 將整個遊戲表面自動旋轉 90 度，讓玩家直接進入橫向遊戲畫面。
- 保留 V0.5.0 Sprite / Layer、多人同步、任務與貓咪功能。

## 測試

- `npm run check` ✅
- `npm run build` ✅
