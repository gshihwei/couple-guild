# Couple Guild V0.4.0

## RPG World UI Integration

V0.4.0 整合 V0.3.10–V0.3.13 的 HUD、玩家、地圖與貓咪系統，將 Couple Guild 往完整線上雙人 RPG 體驗推進。

### 本版
- RPG World HUD：公會、等級、XP、Gold、貓罐頭
- 冒險任務追蹤與任務通知 badge
- 小鎮圓形 Mini Map
- 完整世界地圖 workspace
- 右側互動／摸摸／餵食／玩耍快捷操作
- 底部 RPG 導航：公會、任務、貓咪、背包、地圖
- 線上成員人數狀態
- 保留 Supabase、Realtime、公會、任務與貓咪核心
- Service Worker cache 升級至 v0.4.0

### 測試
- `npm run check`
- `npm run build`
- Render Supabase build injection


## Hotfix 2
- 修正任務、貓咪、商店、日誌、地圖面板右上角 × 無法關閉的問題。
- 所有 `data-close` 面板按鈕統一回到世界畫面。
