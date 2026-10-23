# JOBBY WORLD — Alpha 0.8 (co-op development branch)

## One website, one repository
All new source is inside `MUSTAFA9223/jobby-site`: the existing website, the 3D solo game, the private-room frontend, the Cloudflare Worker API, and the Durable Object room coordinator. No Railway service or second gameplay website is used.

This release is currently on `feature/world-coop-rooms` and **is not deployed or verified on the live phone website**. Keep `main` production unchanged until the Cloudflare deployment has been checked.

## Routes (once the branch is deployed)
- `/world/index.html`: 3D menu, choose a hero, local points, solo mode and PRIVATE CO-OP entry.
- `/world/play.html`: solo adventure preserved.
- `/world/rooms.html`: create private room, join with a six-character code, copy shareable invite link, view live player list.
- `/world/play.html?room=ABC234`: the same 3D arena with multiple independent player avatars.
- `GET /api/world/health`: reports Worker room binding readiness.
- `POST /api/world/rooms`: creates an unlisted code (needs same-origin JSON, a random session ID).
- `GET /api/world/rooms/{CODE}`: retrieves room status.
- `GET /api/world/rooms/{CODE}/socket`: upgraded WebSocket for presence, 3D movement and shared objectives.
- `/world/models/JOBBY.glb`: same-origin proxy to the original user-owned 3D asset on GitHub Raw.

## Scope implemented on this branch
- One same-domain Cloudflare Worker serves the existing site; only multiplayer API and the JOBBY proxy path call the Worker before static assets.
- SQLite-backed Durable Object room state and WebSocket hibernation support.
- 2–6 concurrent browser participants, host-controlled start, room join, leave and roster updates.
- Join code, invite link, English-only UI, avatar selection and camera controls.
- WebSocket pose relay and individual Three.js models for other squad members.
- Three shared server-validated key pickups and server-triggered team escape completion.
- The solo version, local points, character unlocks and leaderboard are preserved.
- The co-op mode **does not issue points or tokens**, since server-side account identity and an anti-cheat economy have not been implemented.
- Does not include voice chat, global leaderboard, persistent accounts or user moderation.

## Important limitations
- An unlisted room code is not a secure password. Do not share it publicly.
- Rooms have a 24-hour lifetime, up to six connections. The host needs another player before starting.
- Basic range validation for keys and positions exists, but there is no full server-side physics anti-cheat.
- Browser connections should be tested on two **different mobile devices** after deployment. JavaScript syntax checks do not prove network or animation quality.
- Durable Objects use Cloudflare Workers plan quotas. The free plan can support SQLite-backed Durable Objects, subject to usage limits.
- JOBBY's binary is still stored in the earlier user-owned `JOBBY-3D-Viewer` repository; the new Worker serves it to the browser through a `jobby.lol` URL with edge caching. To completely eliminate the other repository dependency, copy the `JOBBY.glb` binary into `public/world/models/` using an authenticated Git or GitHub binary upload and then remove the Worker proxy.
- Because adding `main="worker.js"` and a Durable Object binding changes production deployment behavior, verify Cloudflare access, the Worker binding and the `/health` / static homepage before promoting the branch.

## Deployment readiness and safe checks
1. Make sure Cloudflare Worker `jobby` is the site's production deployment and the Wrangler account has access to the same project.
2. Build/test this branch separately with `npm ci` and `npx wrangler dev`.
3. Check `/world/index.html`, `/world/rooms.html`, and the REST create/status endpoints.
4. Start two mobile sessions in the same room; verify each sees the other's character, shared key state, and team escape.
5. Verify `/world/models/JOBBY.glb` serves a nonempty GLB file and test character animations.
6. Only after successful checks, merge or explicitly deploy the branch to the existing Worker/custom domain.
