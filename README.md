# JOBBY

Official website repository for the JOBBY project.

## Alpha 0.12 — named player saves

`WORLD_PLAYERS` is a separate SQLite Durable Object for persistent player profiles and the global leaderboard. The existing `WORLD_ROOM` namespace, homepage, solo maps and voice relay remain in place. Wrangler adds the `world-players-v1` migration and an isolated preview binding.

The WORLD → PLAYER panel lets each person name their player, create another player on the same device, switch saved players, and recover a player on another device with a private 256-bit recovery code. A name alone never authenticates a save. The browser keeps the code locally and sends it in an Authorization header; only a domain-separated hash reaches database storage. The public leaderboard contains public IDs, names, earned points, wins and best times, never recovery codes or private balances. There is no email/password service and no lost-code recovery.

On first entry, existing device points, purchased characters, selected character and solo history are imported once; a local backup is retained at `jobby-world-before-profiles-v1`. Each later player starts separately at zero. Imported points stay spendable but do not enter global rankings. New solo task/key rewards and escape bonuses use per-player round IDs with idempotent claims, and character purchases are charged on the server. The browser retains queued actions through navigation/offline periods and retries on reconnect. Offline runs keep their points but are excluded from fastest-time records if their start arrives late. Personal totals include imported wins. Co-op rewards are still disabled.

Rankings are experimental casual game scores: the solo renderer and task detection still run on the client, so this is not a competitive anti-cheat system. No monetary rewards are offered. Server save data is authoritative after sync; simultaneous active solo rounds for the same player are unsupported. Keep a recovery code before clearing browser data. Do not publish it in an invite or screenshot.

Validation includes client offline/reload queue tests, actual workerd profile API tests (identity separation, migration, recovery, duplicate claims, purchases and public rankings), and the existing twelve-client room/voice runtime test.
