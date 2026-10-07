# Couple Guild V0.4.5 — Reference Image Lock

本版本依照使用者提供的右側 16:9 RPG 參考圖，直接將該圖作為遊戲主畫面素材，而不是以 Canvas 重新仿製。

## 核心變更
- `public/assets/reference-rpg-scene.png`：提供的 RPG 參考畫面原圖
- Canvas 在 V0.4.5 直接繪製參考圖至 1280x720 遊戲 viewport
- HTML HUD 改為透明 hit-area，保留既有互動按鈕與功能
- Supabase / 多人同步 / 任務 / 貓咪邏輯保留
- 16:9 landscape 為基準

## 注意
這是「視覺 1:1 lock」版本。參考圖本身是靜態合成畫面，因此角色與場景在主畫面中不會因移動而改變像素內容；互動功能仍可透過透明控制區觸發。若要同時做到 1:1 視覺與完全動態場景，下一階段需要把參考圖拆成背景、HUD、角色、貓咪、建築等獨立素材層。

## 測試
- `npm run check`
- `npm run build`
