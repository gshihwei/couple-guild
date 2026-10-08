# Couple Guild V0.5.12

## Reference Background Joystick Removal

### 修正
- 移除參考 RPG 背景圖片內嵌的舊虛擬搖桿。
- 保留左下河道、橋面、水面與植栽場景。
- 不再依賴 DOM/CSS 隱藏搖桿。
- 電腦維持 WASD / 方向鍵。
- 手機維持長按＋拖動移動。
- Service Worker cache 升版，避免舊背景圖殘留。

### 驗證
- `npm run check`
- `npm run build`
