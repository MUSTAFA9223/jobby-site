# JOBBY WORLD — Alpha 0.6

## Current milestone: JOBBY is playable again
At the owner's explicit request, the previously withheld JOBBY GLB is restored as the **first, free, playable** character in the main lobby and the solo maze. This is a temporary 3D character study, **not claimed to accurately reproduce the approved white-and-purple JOBBY illustration**.

- 3D URL: `https://raw.githubusercontent.com/MUSTAFA9223/JOBBY-3D-Viewer/main/models/JOBBY.glb` (1.9 MB). It is reused from the owner's existing repository, not modified or duplicated.
- JOBBY appears first in the `AVATARS` collection of `hub.js` and `main.js`.
- Selecting JOBBY persists to the same-device `jobby-world-v01` localStorage record and is honored by solo play.
- Tapping the JOBBY card opens a real GLTFLoader/OrbitControls rotatable 3D viewer, and the select button enables playing the maze as JOBBY.
- The main hero image still shows the owner's approved 2D reference illustration, which may differ from the trial model.

## Entry points
- Home screen: `/world/index.html?v=8`
- Escape minigame: `/world/play.html?v=8`
- Repo paths: `public/world/index.html`, `hub.js`, `play.html`, `main.js`.
- Main JS cache bump: `hub.js?v=4` and `main.js?v=7`.

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
