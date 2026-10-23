# JOBBY WORLD — Alpha 0.10

One repository (`MUSTAFA9223/jobby-site`) and one official website (`jobby.lol`).
The existing homepage, solo game, points and character unlocks are retained.

## Play
- `/world/`: character selection, solo escape and private co-op.
- `/world/rooms.html`: create a room or join by six-character code, 2–12 players.
- `/world/play.html?room=ABC234`: cooperative arena with independent characters and shared keys.
- `/api/world/health`: Worker health and release version.

## Alpha 0.10
- Room voice is available in the lobby and during co-op gameplay.
- Tap **JOIN VOICE** and grant microphone permission on each device.
- **MUTE MIC**, **SOUND ON/OFF** and **LEAVE VOICE** control capture and playback independently.
- Voice stops and releases microphone tracks on leaving the page or losing the room connection.
- Moving from lobby to game opens a new page: tap **JOIN VOICE** again in-game.
- Microphones are off by default. Only participants who opt into voice receive audio frames.
- Live audio passes through the existing room WebSocket on Cloudflare. No separate hosting service, TURN account or voice subscription is required.
- Audio is not recorded or stored. Frames use 16 kHz mono PCM in 80 ms packets, silence gating, bounded playback queues and rate/size limits. Bandwidth is roughly 32 KB/s per actively speaking participant before transport overhead; Cloudflare usage quotas still apply.
- Walls remain opaque. The camera shortens its follow distance before colliding with walls and switches overhead in tight corners, including while smoothing between positions.
- Open mic uses native echo cancellation, noise suppression and a playback guard: outgoing audio pauses while room audio plays, plus a 180 ms acoustic tail. This favors one speaker at a time; simultaneous speech may be suppressed.
- Switch **MODE: OPEN MIC** to **HOLD TO TALK** for nearby speakerphones. Hold the talk button to transmit; playback pauses while holding. Releasing, canceling a touch or changing focus mutes capture again.
- Rooms allow up to 12 players. Remote characters share cached model downloads, use separate skeletons, omit shadows and update animation at 20 fps; movement still interpolates each frame.

## Architecture
`worker.js` serves the same static website and routes multiplayer requests to the SQLite-backed `WorldRoom` Durable Object. Each room has its own state and WebSockets. Audio sender identity is derived from the authenticated socket rather than client-supplied metadata. Audio never enters Durable Object storage.

The JOBBY model is served at `/world/models/JOBBY.glb` through the existing user-owned model repository proxy. Other heroes remain local GLB files.

## Validation
```sh
node --test tests/*.test.mjs
npm install --no-audit --no-fund
npx wrangler deploy --dry-run --outdir .build/world
node tests/world-voice-runtime.mjs .build/world/worker.js
```

Tests cover room lifecycle and session identity; voice opt-in, mute enforcement, room isolation, frame size/rate validation, no self echo, PCM sample timing, microphone permission failures/cleanup, and camera collision, echo guard and hold-to-talk regression cases. The runtime test uses twelve real WebSockets against workerd with synthetic audio, while gameplay messages run alongside voice. Physical microphone quality, speaker echo and visual camera behavior should also be checked on real phones, especially a full 12-player room.

## Hosting
Cloudflare builds a Preview for feature branches using `npx wrangler preview`. Preview room bindings are isolated. Production uses `main` and `npx wrangler deploy`. Existing domain routes and Durable Object migrations are retained.

Co-op rewards, live token conversion, global rankings and full anti-cheat are not enabled. Solo points remain local.
