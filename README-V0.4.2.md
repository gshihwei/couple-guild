# Couple Guild V0.4.2 — Reference RPG HUD Rebuild

本版本依照使用者提供的 RPG HUD 參考圖重新建立遊戲介面層級。

## 完成內容
- 左上大型公會資訊卡：徽章、名稱、Lv、XP 條
- 右上 Gold / XP / 貓罐頭資源膠囊與加號
- 郵件／通知／選單三個大型頂部按鈕
- 左側「冒險中的任務」三列式 RPG 任務卡，依實際任務動態渲染
- 右上圓形小地圖與場景標籤
- 右側大型圓形互動／摸摸／餵食／玩耍按鈕
- 右下大型方向按鈕
- 左下大型半透明虛擬搖桿
- 左下線上同步與成員頭像狀態列
- 底部中央 5 顆圓形 RPG 導航按鈕，公會置中高亮
- 移除舊版網頁式 WASD 提示
- 保留既有 Supabase、任務、多人同步、貓咪與遊戲核心邏輯

## 驗證
- `npm run check`
- `npm run build`

## Git commit
`feat: rebuild rpg hud to match reference`
