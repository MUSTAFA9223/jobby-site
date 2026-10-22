# JOBBY WORLD — Alpha 0.7

## Current milestone: English-only mobile UI and clearer camera
At the owner's explicit request, the previously withheld JOBBY GLB is restored as the **first, free, playable** character in the main lobby and the solo maze. This is a temporary 3D character study, **not claimed to accurately reproduce the approved white-and-purple JOBBY illustration**.

- 3D URL: `https://raw.githubusercontent.com/MUSTAFA9223/JOBBY-3D-Viewer/main/models/JOBBY.glb` (1.9 MB). It is reused from the owner's existing repository, not modified or duplicated.
- JOBBY appears first in the `AVATARS` collection of `hub.js` and `main.js`.
- Selecting JOBBY persists to the same-device `jobby-world-v01` localStorage record and is honored by solo play.
- Tapping the JOBBY card opens a real GLTFLoader/OrbitControls rotatable 3D viewer, and the select button enables playing the maze as JOBBY.
- The main hero image still shows the owner's approved 2D reference illustration, which may differ from the trial model.

## Alpha 0.7 changes
- All visible home, avatar picker, 3D preview, leaderboard, solo gameplay, HUD, game instructions and notifications are in English (left-to-right, en-US formatting).
- The existing 3D map, open-roof house, keys, 6 heroes, key collection, local points and unlocks are retained.
- Character stays visible near walls: any intersecting level block becomes translucent rather than moving the third-person camera against the player.
- Run and jump buttons remain large for touchscreens; 360-degree camera drag and pinch zoom remain available.
- Each key adds 10 points and the exit adds 50 bonus points; the leaderboard correctly records **80 total points earned per successful round**, while the win screen describes the 50-point completion bonus.
- Stored points, unlocked characters and local leaderboard use the existing keys without clearing progress.
- Online multiplayer, live voice, private rooms, global rankings and token rewards are NOT implemented.
- Deployment and real-mobile runtime remain to be independently verified.

## Entry points
- Home screen: `/world/index.html?v=9`
- Escape minigame: `/world/play.html?v=8`
- Repo paths: `public/world/index.html`, `hub.js`, `play.html`, `main.js`.
- Main JS cache bump: `hub.js?v=5` and `main.js?v=8`.

## Other playable characters and economy
Free: JOBBY, Explorer, Ninja, Pug. Prototype point unlocks: Wizard (80), Pirate (120).
Points, purchases, and the time leaderboard remain local to the browser. Online multiplayer and global leaderboards are not implemented.

## Verification and caveats
- GitHub source was changed; asset locations and JS syntax can be checked in repository.
- **The live website and gameplay have NOT been verified in a real browser on the owner's phone after this commit.**
- JOBBY's asset URL is served by GitHub Raw from the owner's separate 3D Viewer repository. If that repo/file goes away or the network blocks raw.githubusercontent.com, JOBBY won't load. A later release should move or mirror this GLB to first-party static hosting.
- The 3D model is temporary at the owner's request; future improvements should match the 2D approved mascot.

## Safety
The main website homepage and the older JOBBY-3D-Viewer files are not modified by this update.
