# JOBBY WORLD — Alpha 0.3

Independent browser-based 3D exploration prototype hosted in the JOBBY website repository at `public/world/`.
Changes to this directory do not overwrite the website home page or the older 3D character viewer.

## Implemented
- Five self-contained, ~1–1.4 MB GLB character models loaded individually (no 21 MB ZIP download).
- Original Idle, Walk, Run, and Jump animations; touch joystick and mobile run/jump actions.
- 56 × 56 courtyard, walk-in open-roof house with an internal passage, paths, props, trees, and three collectible keys.
- Enlarged mobile joystick and run/jump buttons, unrestricted 360° horizontal camera, pinch zoom, reset camera and zoom controls.
- Third-person camera checks the walls before moving behind them. Nearby occluding walls turn semi-transparent.
- Toggleable overhead minimap showing house, obstacles, keys, player, direction and EXIT.
- Finish the round by collecting all three keys and reaching the north gate; test points and avatar unlocks stay in localStorage.

## Important limitations
- Alpha version. The full experience has **not** been manually tested on the user's specific phone.
- Online multiplayer, monster AI, secure points/leaderboard, account synchronization, other game modes and Telegram account authentication are **not yet implemented**.
- Browser cached versions can be bypassed via `/world/index.html?v=4`.
- The house is a basic playable blockout, not final environment art.

## Technical
- Three.js 0.169.0 (ES module import map), GLTFLoader, standalone static assets.
- Individual models are in `public/world/models/*.glb`.
- Files: `index.html` for UI and touch controls, `main.js` for game logic.
- This code is maintained by the repository owner. Character pack licensing should be independently checked before commercial use.

## Next proposed milestone
Build a lightweight indoor puzzle (switches or keys), proper exit-door interaction, a patrolling monster, and then a server-authoritative online co-op proof of concept for two players before scaling to six.
