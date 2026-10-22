# JOBBY WORLD — Alpha 0.5

## Official JOBBY identity
The intended mascot is the user's approved **white/cream creature with large dark-purple eyes and purple ears, horn and limb tips**. The lobby uses a crop from the user's own JOBBY Escape concept sheet, preserved as `public/world/assets/jobby-original.webp`.

The older `JOBBY-3D-Viewer/models/JOBBY.glb` is a 3D study and **has not been approved as the accurate official JOBBY**. It is no longer displayed as JOBBY in the new game interface nor offered as a playable character. A faithful 3D rigged model will be needed to add JOBBY to the playable roster. Do not claim the current older GLB is the official avatar.

## Entry points
- `/world/index.html`: mobile-first character collection / lobby / local leaderboard.
- `/world/play.html`: existing solo 3D escape proof of concept.

## Available
- Original JOBBY artwork visible on the home page and as the first character card; the card opens the official image and a disclosure that a matching 3D model is not ready.
- Three free *playable* 3D characters: Explorer, Ninja and Pug, and two prototype unlockables Wizard (80) and Pirate (120) points.
- Real GLB thumbnail previews generated only for the other playable characters and cached as small WebP images.
- Touch controls, third-person camera, large map, house, three keys, gate, and a replayable solo challenge.
- Points, unlocks, and local leaderboard are browser-local prototype data, not global or token-backed.

## Limitations
- Matching playable 3D JOBBY, server-based multiplayer, online/global leaderboard, and Telegram token rewards are not yet available.
- The deployed site at https://jobby.lol/world/index.html?v=7 may update according to the website's deployment pipeline. GitHub source changes alone do not guarantee the live deployment.
- Never substitute an unrelated human-like character or approximate creature model for official JOBBY.

## Repository isolation
The main jobby-site homepage and old JOBBY-3D-Viewer files remain unchanged.
