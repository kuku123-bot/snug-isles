# Snug Isles — dev notes (architecture + decisions)

Cozy 2-player co-op island crafting/building game. Browser (Canvas2D + DOM UI), iPad 11 + MacBook M4.
Original art/audio (all procedural). NOT affiliated with, and uses no assets from, Forager.

## Hard rules
- No third-party game assets. All sprites are generated in code (`js/gfx`), all audio is WebAudio synth.
- Pure modules (no DOM): `js/util.js`, `js/data/*`, `js/sim/*`, `js/gfx/pixmap.js`, `js/net/protocol.js` -> testable in Node.
- Host-authoritative multiplayer. Client moves its own player locally (client-authoritative position),
  everything else (inventory, world, mobs, drops, crafting) is host-side; client mirrors via events+snapshots.
- Worldgen runs ONLY on the host; client receives ground data in snapshot / `land` events (no cross-engine determinism needed).
- Structures/blueprints are NOT items: they are built from the Build menu using materials (Forager style).
- Never commit secrets. Repo is public (GitHub Pages free tier). Commits use the GitHub noreply email.

## Rendering
- Low-res canvas in "art pixels" (TILE = 16). Integer scale `s` = round(deviceHeight / 280). CSS upscales w/ `image-rendering: pixelated`.
- DOM for UI (crisp text, easy touch). Icons come from the sprite atlas via CSS background-position.
- Walls: "face + thin cap" style (16x20 sprite: 4px cap above footprint, 16px face). Windows/doors anywhere. Autotile by N/E/W.
- Floors: flat 16x16. Furniture/things: upright sprites, bottom-aligned to footprint, y-sorted by footprint bottom.

## World
- Lands are 20x20 tile squares in a grid (default 9x9). Start land in the middle. Buy adjacent lands with shared coins.
- Biomes: meadow, desert, tundra, swamp, graveyard, volcano, crystal, void.
- Layers (typed arrays): ground, floor, wall, wallState, occ(thing id). Things in a Map (resources, stations, furniture).

## Progression
- Per-player: inventory, XP/level, skill tree (points per level), hp/hunger/energy.
- Shared: coins, tech tree (research at Research Table), lands, world time, chests.
- Tiers 0..8: wood/stone -> copper -> iron -> gold -> swamp/graveyard magic -> volcano obsidian -> crystal -> void/star.

## Networking
- PeerJS cloud signaling (WebRTC datachannel, JSON strings, own chunking) + manual copy/paste signaling fallback.
- Host sends: events (reliable, batched), snapshots (mobs/drops/players ~15Hz), private player state.
- Client sends: pos (~25Hz), commands.
- Either player can host: client keeps a backup copy of the world.

## Things that were learned the hard way (keep these in mind)
- **Networking**: free public TURN relays are dead (the old "openrelay" one included). The ICE list contains only STUN servers that were probed live; connections are direct P2P. `?turn=…` adds a relay on one device. Tested: cloud PeerJS + local PeerServer + manual copy/paste, Chromium<->WebKit, reconnect, backup copy.
- **Manual pairing**: the host's wait only starts when the answer is pasted (humans take minutes); the panel keeps its `<details>`/textareas across re-renders (it used to be rebuilt on every status change).
- **Backup relay** (`net/mqtt.js`, `net/relay.js`, `net/relaykey.js`): public MQTT brokers over WSS as a dumb pipe. Measured: HiveMQ delivers 100% up to 80 msg/s, EMQX drops 30-70% above ~15/s, Mosquitto's test server is sometimes down; so HiveMQ goes first, the others join after a stagger, relay links run at about half the message rate (`conn.lowRate`). Messages are AES-GCM sealed (`role|gid|seq|text`, key from an 80-bit code, topics from a hash of it), numbered per direction, duplicates dropped, short reordering tolerated, a persistent gap closes the link so the app reconnects (fresh snapshot). The guest repeats everything on each relay it can reach until the host answers, then pins to the answering one; the host answers on every relay it recently heard that guest on. Direct WebRTC is always tried first. The developer's own network showed symmetric NAT (two STUN servers gave different mapped ports), which is exactly why this exists.
- **Join approval**: `HostLink` asks the host before admitting a pid that is not in `world.players` (room codes are 5 chars). The card lives in `#joinreqs` above every panel. A returning partner on a new device can claim an offline character (`adopt` + `prk` event). `PROTOCOL` bumps on any wire change; `BUILD_ID` (source hash, injected by tools/build.mjs) only produces a soft "different versions" warning.
- **Goals** (`data/goals.js`, `sim/goals.js`): the host evaluates conditions on a census every 1.5s; counters live in `shared.flags.gs` (host only, persisted), the done-list in `shared.flags.goals` (replicated by `goal`/`goals` events + snapshot). Item goals use `made_<item>` counters (crafted/smelted/produced), never inventory contents (the starting kit would complete them).
- **Spawning**: lands are 20x20 so the old 14-23 tile spawn ring never fit the starting island; `spawnTick` falls back to a closer ring and scales the early crowd. New worlds have `flags.age` (played seconds): peaceful for 120s, ramping to full over 240s.
- **Pets** (`sim/pets.js`): `p.pet` (saved in `serializePlayer`, which is a field whitelist: new player fields must be added there!) + a follower mob with `m.pet = pid` handled by `petAI` in combat.js; `ensurePets` re-creates it every ~1.5s; pets are excluded from spawn caps. The Old Key is consumed by `openWildChest` for a second loot roll.
- **Refunds** equal what building costs *now* (`buildMult`), otherwise discounts could be farmed by build/remove cycles.
- **Presets** must only use values that exist in `OPTIONS` or `sanitizeSettings` silently resets them (tests/content.test.js checks).
- **Touch**: while building, the joystick zone shrinks to a corner (`.joyzone.compact`) so the rest of the screen paints; quick taps count (pointerdown+up inside one frame); furniture is placed on finger-lift so you can slide the ghost. Wake lock is re-requested on `visibilitychange`.
- **Short windows** (iPad Safari with toolbars ~1180x700): menus use `100vh`-based heights and a `max-height: 740px` media query.
- **Smooth look** (`render/smooth.js`, `gfx/smooth.js`, `render/labels.js`, `gfx/style.js`): the game still draws into the low-res art canvas; a WebGL2 presenter lays a device-resolution canvas over it and runs a "vote" upscaler (each nearby art pixel votes for its colour with a gaussian weight, margin = anti-aliasing) so staircases become slopes and blobs round. `gfx/smooth.js` is the CPU reference; `tests/smooth.test.js` pins its behaviour and `tools/e2e-smooth.mjs` checks the GPU output against it pixel by pixel (worst error 1/255). Lessons: (1) a per-pixel colour bias keeps detail but stops shapes rounding, so thin things are protected *adaptively* (a pixel's colour must win at its own centre by `MIN_CENTRE_MARGIN`) and thick shapes get no bias; (2) edge width must come from the local vote gradient, a fixed width fades dots and lines at low zoom; (3) a GPU speed check must take the *fastest of several runs* (queued compositor work inflates one run) and only on real frames; slow GPUs first draw at 75%/55% of the pixels (`Presenter.rs`), then fall back to the pixel look; (4) headless Chromium renders WebGL in software (SwiftShader), so the presenter refuses software renderers unless `?force=1`: the old e2e suites keep exercising the pixel path, `e2e-smooth.mjs` forces the shader; (5) the 2D art canvas is never hidden (the GL canvas just covers it), so pointer coordinates, fallbacks and context loss are free. In-world text (name tags, numbers, prices) is drawn by `TextLayer` with the round UI font at full resolution; the UI font is Fredoka (`:root[data-look=pixel]` brings back Pixelify). Art knobs (soft outlines, ground noise, no dithering) live in `gfx/style.js`.

## Test map
- `npm test`: sim, rules (one test per world option), content (reference integrity + reachability fixpoint of every item/tech/blueprint/recipe), playthrough (craft every recipe, build+remove every blueprint, research the tree, machines, altars…), serialize/backup, net loopback (join/approval/replication/goals).
- Browser: tools/e2e.mjs (mouse/keyboard), e2e-touch.mjs (real CDP touch incl. two thumbs), e2e-mp.mjs (two browsers), e2e-manual.mjs, perf.mjs (CPU-throttled stress scene), e2e-smooth.mjs (the smooth look: shader vs CPU reference, photo, settings, context loss, slow-GPU fallback), screens.mjs, live.mjs (deployed site).

## Status log
- (see git log)
