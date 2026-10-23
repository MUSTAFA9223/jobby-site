# JOBBY

Official website repository for the JOBBY project.

## Alpha 0.12 — named player saves

`WORLD_PLAYERS` is a separate SQLite Durable Object for persistent player profiles and the global leaderboard. The existing `WORLD_ROOM` namespace, homepage, solo maps and voice relay remain in place. Wrangler adds the `world-players-v1` migration and an isolated preview binding.

The WORLD → PLAYER panel lets each person name their player, create another player on the same device, switch saved players, and recover a player on another device with a private 256-bit recovery code. A name alone never authenticates a save. The browser keeps the code locally and sends it in an Authorization header; only a domain-separated hash reaches database storage. The public leaderboard contains public IDs, names, earned points, wins and best times, never recovery codes or private balances. There is no email/password service and no lost-code recovery.

On first entry, existing device points, purchased characters, selected character and solo history are imported once; a local backup is retained at `jobby-world-before-profiles-v1`. Each later player starts separately at zero. Imported points stay spendable but do not enter global rankings. New solo task/key rewards and escape bonuses use per-player round IDs with idempotent claims, and character purchases are charged on the server. The browser retains queued actions through navigation/offline periods and retries on reconnect. Offline runs keep their points but are excluded from fastest-time records if their start arrives late. Personal totals include imported wins. Co-op rewards are still disabled.

Rankings are experimental casual game scores: the solo renderer and task detection still run on the client, so this is not a competitive anti-cheat system. No monetary rewards are offered. Server save data is authoritative after sync; simultaneous active solo rounds for the same player are unsupported. Keep a recovery code before clearing browser data. Do not publish it in an invite or screenshot.

Validation includes client offline/reload queue tests, actual workerd profile API tests (identity separation, migration, recovery, duplicate claims, purchases and public rankings), and the existing twelve-client room/voice runtime test.

## Alpha 0.13 — Warehouse Escape

The default WORLD play button now opens `warehouse.html`; Big House and Classic remain selectable. The warehouse uses the existing mobile joystick, orbit camera, named-player saves and compact optional voice controls. Its pure layout and puzzle rules are shared by solo and Cloudflare's room server.

A six-minute round connects three puzzles: read a randomized three-symbol dispatch code and enter it at the power panel; operate the timed shutter to collect and install a fuse; then deliver the crate matching the dispatch symbol. Wrong inputs, machines and running attract the chef. Cargo has one carrier and is returned safely after capture/disconnection. The solo shutter stays open for 18 seconds, the cooperative shutter can be held open, and an inside emergency release prevents a trap. Solved tasks survive catches. Caught co-op players wait in the rescue bay for a two-second teammate interaction or automatically leave after twelve seconds. Rounds can restart in the same room with fresh clues. An interactive route guide is at `warehouse-plan.html`.

Warehouse co-op rewards are assigned internally by the room server to linked active participants: 50 escape points, 10 per completed puzzle contribution, and 5 per rescue capped at three. The profile API hashes the private room session before linking it to a player; recovery secrets never enter room URLs or broadcasts. An internal idempotent award ledger prevents duplicate rewards on replay/reconnect, and an undelivered award payload is retried when the completed room is opened again. Existing Big House/Classic co-op rewards remain disabled. Solo warehouse rewards use the existing saved-round queue and require all three task claims. Solo gameplay remains client-side and is not competitive anti-cheat.

Seven small, unmodified Kenney models are bundled from Building Kit 1.0 and Factory Kit 3.0 under CC0, with each pack's own texture and original license. They are loaded only by the warehouse. Shared assets are cached and cloned; static box geometry is batched with instancing. Lightweight procedural visuals remain if a model fails to download, and collision bounds are independent of loading. Sources: https://kenney.nl/assets/building-kit and https://kenney.nl/assets/factory-kit . The map overview is rendered from the level geometry; it is not a WebGL gameplay screenshot.

Checks: warehouse route/collision, deterministic clues, wrong answers, held actions, exclusive cargo, emergency release, rescue/auto-release, noise, time limit, actual Three.js scene/solo completion, license/texture references, and a workerd runtime with twelve real WebSockets, server puzzle validation, reconnect, per-player profile rewards and restart. The earlier voice/house/profile tests remain enabled. A physical phone GPU and microphone are not available in the automated runtime.
