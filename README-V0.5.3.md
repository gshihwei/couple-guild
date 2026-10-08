# Couple Guild V0.5.3 — Reference Cat Coats

## 版本目標

依使用者提供的參考圖，將固定兩隻貓的花色與外觀鎖定為該圖中的造型。

## 飛飛

- 白色為主體
- 臉部棕色／虎斑花紋
- 黃褐色眼睛
- 白胸、白腳
- 保留原本「黏人」性格

## 呼呼

- 棕灰色虎斑
- 明顯額頭與臉部虎斑紋
- 金黃色大眼
- 白色口鼻、胸口與腳
- 深色條紋尾巴
- 保留原本「調皮」性格

## 技術變更

- 參考圖直接裁切為透明 PNG Sprite
- 更新 `public/assets/v050/cat1.png`
- 更新 `public/assets/v050/cat2.png`
- 同步更新 `/assets/fly.png` 與 `/assets/hu.png`，避免寵物面板與遊戲場景外觀不一致
- 不修改貓咪 AI、性格、任務或 Supabase 多人同步
- Service Worker cache 升版至 V0.5.3

## 驗證

- `npm run check`
- `npm run build`
