# JOBBY WORLD Alpha 0.15 — Castle & Labyrinth

The default world entry now opens a castle escape. Brand homepage `/` and all
previous maps remain available. The deployment still uses the existing Cloudflare
Worker, Durable Objects, player store, routes, and GitHub main build integration.

## Playable level

- Ground-floor courtyard, deterministic 4×6 labyrinth, Rune Hall, Royal Archive,
  Seal Chamber, Sun Vault and an east exit. Shared geometry drives movement,
  guardian navigation, camera collision, minimap and server validation.
- Eight-minute solo or private 2–12-player escape. Find the tablet's randomized
  rune sequence, recover the timed-vault crystal, then match and return a royal
  seal. Wrong choices and running attract a non-combat guardian.
- Blue hiding locations, automatic twelve-second release, two-second teammate
  rescues, an inside vault release and a shutter that waits for a player in its
  opening. Completed puzzles survive a catch or game-page reconnect.
- Intent-based server puzzle checks, held actions, exclusive cargo and serialized
  castle room input. Private clues are not included in shared round snapshots.
- Existing compact voice controls, player identities, recovery codes, purchases,
  leaderboard and idempotent co-op rewards are reused. Solo escapes earn 80;
  active co-op players earn 50 plus puzzle/rescue contributions.

## Complete CC0 assets

Kenney Castle Kit 2.0 contains 76 supplied GLBs (publisher lists 75). Quaternius
Updated Modular Dungeon contains 48 models, converted from its original OBJ/MTL
files to browser GLB. Both complete unmodified original archives, licenses,
provenance and SHA-256 checksums are retained in `asset-sources/`. Identical ZIP
copies can be downloaded from `/world/packs/`.

Each model is available in `/world/models/{castle,dungeon}/`; manifests record
bounds, orientation, dimensions, triangles and original source. The game only
loads used model types, caches each once and instances repeated walls/floors.
The model library includes all 124 actual model previews, search, filters,
individual GLB downloads and a one-model-at-a-time orbit viewer. Static previews
are CPU renders from the shipped GLB geometry with simplified lighting; they
also display if a viewer cannot initialize WebGL. They are not gameplay captures.

Rebuild: `python tools/import-castle-dungeon-assets.py`, then
`node tools/render-castle-assets.mjs` (Python dependencies are in the import tool;
Node requires the existing three/sharp modules).

## Validation

- `node --test tests/*.test.mjs` — puzzle rules, all twelve spawns, routes to every
  objective, scene boot, 80-point solo completion, model bounds/texture references,
  opaque instanced geometry, original archive hashes and existing regressions.
- `npx wrangler deploy --dry-run --outdir .build/world`.
- `node tests/world-castle-runtime.mjs .build/world/worker.js` — twelve real
  workerd WebSockets, private clues, held actions, shared progress, reconnect,
  separately saved rewards, replay protection and restart.
- Existing voice, player, warehouse and race workerd runtime scripts also pass.
- Browser UI inspected through the managed preview: hub navigation, guide,
  model library pictures, filters and search. The cloud browser has WebGL
  disabled, so GPU frame rate and physical-phone gameplay were not verified.
