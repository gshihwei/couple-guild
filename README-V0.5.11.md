# Couple Guild V0.5.11 — Joystick DOM Removal

## Fix
- Removed the legacy `.touch-controls` / `#joystick` / `#stick` DOM from both root and source entry HTML.
- Desktop remains WASD / arrow-key controlled.
- Mobile movement remains long-press + drag directly on the game canvas.
- Removed obsolete joystick lookup/hide code from `src/main.js`.

## Validation
- `npm run check`
- `npm run build`
