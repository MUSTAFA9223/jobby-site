# JOBBY WORLD — Alpha 0.4

## Entry points
- Main lobby: `/world/index.html` (modern mobile front page).
- Solo escape game: `/world/play.html` (existing playable 3D world).

## Implemented
- JOBBY is the first free playable 3D character. The original JOBBY GLB is read from the owner's separate **JOBBY-3D-Viewer** repository; its source was not duplicated or altered.
- Two other free characters: Explorer and Ninja (three free total including JOBBY). Pug costs 60 demo points, Wizard costs 80, and Pirate costs 120.
- Modern landing page, moderately sized character cards, separate **Characters** screen with rotating 3D previews, and a selectable character.
- Avatar-card portraits are generated from the user's genuine GLB files the first time the gallery opens, and cached locally as small still WebP images to reduce repeated model downloads. JOBBY has an immediate official image fallback while its actual 3D thumbnail loads.
- Points and avatar purchases persist via `localStorage` and are shared between the home screen and game on the same device.
- Local leaderboard only: real scores recorded from completed escapes on this device; shows run time, avatar, and round point rewards. No fictitious global competitors.
- Full 3D solo map with enlarged touch joystick, run/jump controls, wall-safe follow camera, camera controls, open-roof house, three keys, and exit.
- Existing JOBBY site homepage and existing 3D viewer were **not** changed.

## Important limitations
- The world game, GLB viewer, and caching behavior have not been confirmed in a real phone browser end-to-end.
- First visit to the character gallery downloads the 3D assets progressively to generate portraits; this may take time on weak mobile networks.
- Multiplayer rooms, global rankings, fraud-proof server points, Telegram identity syncing, and token rewards are NOT implemented.
- Current avatar prices and points are purely prototype/game balancing values and are not real-world rewards.

## Troubleshooting
- Open `https://jobby.lol/world/index.html?v=5` on Chrome for Android.
- If an older page is cached, use the URL with `?v=5`.
- To test the selected avatar, tap a character portrait to preview, tap Select/Unlock, then tap Play.
- 3D model loading requires network access to GitHub's public raw file server for JOBBY, and the local static host for other character models.

## Next
- Validate the home screen, JOBBY animation playback, and PNG/WebP portrait rendering on phone.
- Add cooperative maze gameplay server with private room codes, persistence, and authenticated online leaderboard.
