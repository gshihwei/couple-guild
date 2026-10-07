# Couple Guild V0.5.0 — Sprite / Layer Reconstruction

V0.5.0 converts the supplied RPG reference image from a static screenshot into a layered playable scene.

## Core changes
- Reference scene is used as the visual base plate.
- Player and partner are independent sprites extracted from the supplied reference artwork.
- Flyfly / Huhu are independent cat sprites extracted from the supplied reference artwork.
- Player, partner, remote members and cats are positioned by live game state.
- Existing WASD / arrow keys, virtual joystick, interaction, task board, shop and pet actions remain functional.
- Existing Supabase multiplayer state continues to drive remote player positions.
- The visual HUD remains pixel-locked to the supplied reference image.
- Landscape PWA behavior is retained.

## Test
- `npm run check` passes.
- `npm run build` passes.

## Git
`feat: rebuild reference scene into playable sprite layers`
