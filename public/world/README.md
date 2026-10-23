# JOBBY WORLD — Alpha 0.13

One repository (`MUSTAFA9223/jobby-site`) and one official website (`jobby.lol`).
The existing homepage, solo game, points and character unlocks are retained.

## Warehouse Escape
- `/world/warehouse.html`: default solo / 2–12 player level. `/world/warehouse-plan.html`: overview, puzzle routes and rules.
- Decode a shuffled symbol sequence, retrieve and install a fuse using a timed shutter, then dispatch the matching cargo crate. Solve all three tasks and reach the east loading gate within six minutes.
- The server validates co-op proximity, held interactions, inventory, rescue and completion. Wrong symbols, running and machines attract the chef. Caught players can be rescued or automatically leave the rescue bay after twelve seconds; solo catches return to the yard without clearing solved tasks.
- Active or contributing warehouse teammates earn saved profile points once per round: 50 for escaping, 10 per puzzle contribution, and 5 per rescue (maximum three). Other maps keep their prior rewards.
- Kenney Building Kit and Factory Kit assets are CC0; their licenses and separate textures are bundled in `models/warehouse`. Static meshes are batched for mobile. Solo, character selection, existing maps, private room codes, named-player recovery and compact voice controls remain available.

## Big House escape and chase
- `/world/house.html`: new solo/co-op house map; `/world/house-plan.html`: interactive floor plan and routes.
- Nine interconnected rooms, four hiding spots and three independent task/exit pairs. Hold the action button for 1.6 seconds to take the library key, fix laundry power or take pantry tools.
- Any unlocked matching exit completes the round (for the whole squad in co-op). The chef patrols and chases visible players through the shared walkable grid. Hiding excludes a player from targeting; being caught returns them to the yard with a six-second grace period and preserves completed tasks.
- Cloudflare owns co-op task completion, hiding and chef state; all clients receive the same updates. The chef advances when gameplay poses arrive, and resumes patrol if a room instance wakes from hibernation. No extra server or subscription is used.
- House furnishings and the chef are built from code-native low-poly meshes; no extra art pack download is required. Models, touch controls, voice and solo points keep the existing system.
- Classic solo remains at `/world/play.html`; classic rooms can be created at `/world/rooms.html?map=classic`. Existing rooms keep classic behavior.
- Solo task points are +10 each; an escape adds +50. Big House co-op grants no points or real tokens.

## Play
- `/world/`: character selection, solo escape and private co-op.
- `/world/rooms.html`: create a room or join by six-character code, 2–12 players.
- `/world/play.html?room=ABC234`: classic cooperative arena with independent characters and shared keys.
- `/api/world/health`: Worker health and release version.

## Alpha 0.11
- Room voice is available in the lobby and during co-op gameplay.
- Tap the microphone icon and grant microphone permission on each device.
- Compact microphone and speaker icons control capture/playback with one tap. In-game they sit along the left edge, away from the upper-right minimap and bottom movement controls. In landscape the dock becomes a short row. Voice mode and leave controls are in the small options menu.
- Voice stops and releases microphone tracks on leaving the page or losing the room connection.
- Moving from lobby to game opens a new page: tap the microphone icon again in-game.
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
npm install --no-audit --no-fund
node --test tests/*.test.mjs
npx wrangler deploy --dry-run --outdir .build/world
node tests/world-voice-runtime.mjs .build/world/worker.js
```

Tests cover room lifecycle and session identity; voice opt-in, mute enforcement, room isolation, frame size/rate validation, no self echo, PCM sample timing, microphone permission failures/cleanup, and camera collision, echo guard and hold-to-talk regression cases. The runtime test uses twelve real WebSockets against workerd with synthetic audio, while gameplay messages run alongside voice. Physical microphone quality, speaker echo and visual camera behavior should also be checked on real phones, especially a full 12-player room.

## Hosting
Cloudflare builds a Preview for feature branches using `npx wrangler preview`. Preview room bindings are isolated. Production uses `main` and `npx wrangler deploy`. Existing domain routes and Durable Object migrations are retained.

Co-op rewards, live token conversion, global rankings and full anti-cheat are not enabled. Solo points remain local.
