# Couple Guild V0.3.9 — Multi-member Sync Fix

本版修正三人以上公會的遠端玩家顯示與同步問題，並延續 V0.3.8 的帳號／公會設定修正。

## 本次修正

- 角色名稱改用 `update_my_display_name()` security-definer RPC
- 公會名稱改用 `update_guild_name()` owner-only RPC
- 修正 `Cannot coerce the result to a single JSON object`（PGRST116）
- 公會名稱更新後立即刷新左上角 HUD
- 另一台手機透過 Supabase Realtime 收到公會名稱變更
- `v038-migration.sql` 補上 `guilds` Realtime publication

## Supabase

如果目前 Supabase 尚未執行 V0.3.8 migration，請在 Supabase SQL Editor 執行：

```sql
-- 執行本專案內的 v038-migration.sql
```

Migration 會建立／更新：

- `update_my_display_name(text)`
- `update_guild_name(text)`
- `leave_guild()`
- `guilds` Realtime publication
- 三人以上公會以 `user_id` 分別保存每位遠端玩家，不再用單一 `partner` 覆蓋
- Realtime、polling、initial load 都維持每位玩家的獨立名稱／座標
- 遊戲場景同時繪製所有遠端玩家

## Build

```bash
npm run check
npm run build
```

Render Static Site：

```text
Build Command: npm run build
Publish Directory: dist
```
