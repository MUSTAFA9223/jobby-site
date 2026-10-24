# JOBBY WORLD Alpha 0.16 — Castle & Labyrinth

The default world entry now opens a castle escape. Brand homepage `/` and all
previous maps remain available. The deployment still uses the existing Cloudflare
Worker, Durable Objects, player store, routes, and GitHub main build integration.

## Playable level

- Ground-floor courtyard, deterministic 4×6 labyrinth, Rune Hall, Royal Archive,
  Seal Chamber, Sun Vault and an east exit. Shared geometry drives movement,
  guardian navigation, camera collision, minimap and server validation.
- Twelve-minute solo or private 2–12-player escape. Find the tablet's randomized
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

## Complete estate

The courtyard east gateway connects a three-piece bridge, the outer loop,
northern tower assemblies, western woodland and village, southern timber
yard, crypt camp and east ruins. The original puzzle area and spawn slots stay
connected. Placed bases, midsections, roofs and banners form buildings; closed
ruins and abandoned machinery are scenery. Walking approaches to every original
model and entry routes to every region are checked. Scenery is integrated into
the playable scene, separate from the optional model-inspection library.

At the unlocked east gate, players choose ESCAPE with the action button. They
can continue exploring the estate before finishing the round.

## Complete CC0 assets

Kenney Castle Kit 2.0 contains 76 supplied GLBs (publisher lists 75). Quaternius
Updated Modular Dungeon contains 48 models, converted from its original OBJ/MTL
files to browser GLB. Both complete unmodified original archives, licenses,
provenance and SHA-256 checksums are retained in `asset-sources/`. Identical ZIP
copies can be downloaded from `/world/packs/`.

Each model is available in `/world/models/{castle,dungeon}/`; manifests record
bounds, orientation, dimensions, triangles and original source. All 124 original model types are authored into one connected 104×104-metre
estate, with 164 environment placements in eight outer regions around the
original castle. The game loads the starting area first, then nearby areas
through a single four-request queue. It caches each model once, reuses the
Castle Kit palette texture, and instances repeated walls/floors.
The model library includes all 124 actual model previews, search, filters,
individual GLB downloads and a one-model-at-a-time orbit viewer. Static previews
are CPU renders from the shipped GLB geometry with simplified lighting; they
also display if a viewer cannot initialize WebGL. They are not gameplay captures.

Rebuild: `python tools/import-castle-dungeon-assets.py`, then
`node tools/render-castle-assets.mjs` (Python dependencies are in the import tool;
Node requires the existing three/sharp modules).

## Validation

- `node --test tests/*.test.mjs` — puzzle rules, all twelve spawns, routes to every
  objective, scene boot, 80-point solo completion, complete 124-type scene coverage,
  routes to eight outer regions, model bounds/texture references,
  opaque instanced geometry, original archive hashes and existing regressions.
- `npx wrangler deploy --dry-run --outdir .build/world`.
- `node tests/world-castle-runtime.mjs .build/world/worker.js` — twelve real
  workerd WebSockets, private clues, held actions, shared progress, reconnect,
  separately saved rewards, outer-estate movement, authoritative stream and
  boundary collision, replay protection and restart.
- Existing voice, player, warehouse and race workerd runtime scripts also pass.
- Browser UI inspected through the managed preview: hub navigation, guide,
  model library pictures, filters and search. The cloud browser has WebGL
  disabled, so GPU frame rate and physical-phone gameplay were not verified.

## Private team challenges and separate rankings

The home screen no longer shows the estate overview, legacy-map links, asset
library links, or explanatory blue panels. Rankings have independent SOLO and
MULTIPLAYER tabs and mode-specific totals. Existing recorded solo/co-op history
is classified once without changing balances; unclassified imported balances
never enter either ranking.

PRIVATE MULTIPLAYER now offers CO-OP ESCAPE or TEAM CHALLENGE. Challenges use
the existing obstacle course and private room code, with equal teams of one to
three players (six total). Only the game owner can create challenges and set the entry amount (whole points, 1–1,000,000). Every entrant explicitly confirms that exact amount.
Only free, non-purchasable, non-redeemable game points are used. Teams lock at
start; the first team with every member across all checkpoints and the finish
wins. The complete pool is split equally among that team's frozen roster.
Individual finishes do not earn the ordinary 80-point race award in this mode.

Changing the entry amount in the lobby invalidates all confirmations and changes the terms revision. Stale approvals cannot authorize the new amount. The owner role is bound once to the authenticated saved profile through a private setup code; only its SHA-256 verifier is published. Other players join challenges by code and never inherit owner powers when the owner disconnects.

Entry reservation and settlement are atomic in the player store, reject duplicate
profiles and overlapping entries, and replay safely. Room input and retries are
serialized. Disconnects retain team membership and checkpoint progress. A server
alarm refunds a round without a winner; a separate ten-minute player-store expiry
refunds orphaned entries even if the room never recovers. Rematches require fresh
team selection and entry consent. No new Durable Object namespace is required.

Validation adds real 2v2 workerd WebSockets and SQLite tests for full-pool payouts,
1v1/3v3 splits, insufficient funds, duplicates, retry, expiry refunds, existing-save
migration, and isolated ranking queries. The preview browser has WebGL disabled;
phone rendering and physical touch gameplay still require device verification.

Owner activation: WORLD → PLAYER → GAME OWNER → ENABLE OWNER CONTROLS. The private one-time code is supplied to the project owner separately. Keep the existing player recovery code to retain owner access on another device. The setup code is not a player recovery code.
