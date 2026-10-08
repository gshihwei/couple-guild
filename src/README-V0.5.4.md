# Couple Guild V0.5.4 — Touch Movement & Cat Sprite Fix

## 版本重點

1. **隱藏虛擬搖桿**
   - 桌面版直接使用 WASD / 方向鍵。
   - 手機版移除搖桿 UI。
   - 手機在遊戲世界上長按後，可往上／下／左／右拖動控制角色。
   - 取消額外方向提示，不遮住遊戲畫面。

2. **角色名稱顯示在角色下方**
   - 玩家、另一半、其他線上玩家、飛飛、呼呼統一使用 RPG 深色名牌。
   - 名牌獨立於 Sprite，不會破壞圖片本身。

3. **修正貓咪圖片缺損／背景問題**
   - 將飛飛與呼呼的參考圖片重新處理為透明 Sprite。
   - 移除原圖的米色背景與地面方塊。
   - 同步更新 `public/assets/v050/cat1.png`、`cat2.png`、`fly.png`、`hu.png`。
   - 不修改飛飛／呼呼的性格與 AI。

## 測試

- `npm run check`：通過
- `npm run build`：通過
- Service Worker cache：`v0.5.4-touch-and-cat-fix`
