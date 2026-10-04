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

## Status log
- (see git log)
