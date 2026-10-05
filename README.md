# Snug Isles 🏝️

A cozy two-player island crafting & building game that runs in the browser — made for **iPad** and **Mac**.

Gather resources, buy new lands, research a big tech tree, automate your island, and build the house of your dreams — together, over the internet.

> Inspired by the cozy open-world crafting genre. All art, music and sound in this project are original and generated in code; nothing is taken from any other game.

## What's in it

* **8 biomes** (meadow → desert, tundra, swamp, graveyard, volcano, crystal fields, starlit void), **4 bosses**, 30 creatures, 40 resource types
* **69 technologies** in 8 tiers (stone age → starlit age), **101 recipes**, 42 skills
* **295 build pieces**: 66 wall/window/door/fence styles, 27 floors, 16 wall decorations, **84 pieces of furniture in 7 styles**, lights, farms, animal pens, drills, turrets, warp pads…
* **Automation**: furnaces and drills that load/unload from chests next to them, sprinklers, windmills, turrets
* **Pets**: Mystery Eggs (found in chests, buried treasure and boss drops) hatch a bunny, duckling, chick, lizard, penguin… or a very rare unicorn that trots after you (and comes back after every reload); an **Old Key** in your bag doubles the next treasure chest
* **68 Island Goals** — a gentle checklist with rewards that teaches the game and gives you things to aim for
* **20 world rules** (monsters, damage, health, alertness, night danger, boss strength, yield, regrowth, XP, land price, build cost, research cost, hunger, regeneration, what happens when you faint, sleep rules, day length, weather…) with five presets from *Dreamy Builder* (no monsters, free everything) to *Nightmare*
* **Co-op for two** (up to four), both devices keep a backup copy of the world

## Play

Open the site on any modern browser (Safari on iPad, Chrome/Safari on Mac). On iPad: **Share → Add to Home Screen** for a full-screen, offline-capable app.

**Two players:** one of you picks *Play together → Host a world* and reads out the 5-letter room code (or shares the invite link). The other picks *Play together → Join my partner* and types it. The host taps **Let them in** the first time (so nobody can wander in by guessing a code). Both devices keep a copy of the world, so either of you can host next time.

### If the connection won't start

* Games connect **directly** between your two devices (WebRTC) — the free matchmaking server only introduces you. Same Wi-Fi is the most reliable; most home networks work from different places too.
* **Backup connection** — for strict networks (carrier-grade NAT, some hotspots) that block direct connections: the host opens *Invite / players → Backup connection* and sends the longer backup code too; the partner enters it on the join screen under *Joining does not work?* (or uses the invite link). Everything is end-to-end encrypted (AES-GCM, key only in the code) and passes through free public MQTT relay servers, which only ever see ciphertext. A little slower (~0.2s), but it works almost everywhere. The game tries a direct connection first and falls back by itself.
* **Manual pairing** (Play together → Join → *Pair manually*) works without any matchmaking server: the host makes a code, the partner pastes it and sends an answer code back (still a direct connection).
* The host's screen must stay on and the game in front (the game asks the iPad to stay awake). The Mac makes the steadiest host.
* Want a proper relay (TURN) of your own? Add it with `?turn=turn:host:3478&turnuser=…&turncred=…` on the page address; it is remembered on that device.
* Switched devices or cleared Safari data? The host can hand your old character to your new device when it asks to let you in.

### Privacy

There is no account and no game server. Worlds live in your browser. To connect two devices the game uses free public services: the PeerJS cloud server (only to introduce you; it sees the 5-letter room code), Google/Cloudflare/Nextcloud STUN servers (to learn your public address), and — only if you turn on the backup connection — the HiveMQ/EMQX/Mosquitto public MQTT servers, which only ever see encrypted bytes. As with any direct (peer-to-peer) connection, your partner's device can see your IP address.

### Keep your world safe

Worlds live in the browser's storage. *Your worlds → Backup* saves a file (share it to Files/AirDrop on iPad), *Open a backup* restores it as a new world.

## Controls

| | Mac | iPad |
|---|---|---|
| Move | `WASD` | left thumb joystick |
| Mine / chop / fight | hold left-click | hold the big button (auto-aims) |
| Interact | `E` / click | hand button / tap things |
| Dash | `Space` | dash button |
| Photo | `P` (or the pause menu): saves a clean picture of what you see | pause menu → *Take a photo* (share sheet) |
| Menus | `I` bag · `C` craft · `B` build · `T` research · `K` skills · `M` map · `G` emote | top-right buttons |
| Build | pick a piece, click/drag; `R` flips, `X` removes | pick a piece, drag to paint; furniture: slide the ghost and lift to place; **Rect** fills a whole room |

## Development

```bash
npm install
npm run dev        # build + serve on http://localhost:5173 and rebuild on change
npm test           # 60+ tests: simulation, rules, content reachability, saves, networking (Node)
npm run build      # production bundle in dist/

# browser tests (Playwright: Chromium + WebKit)
node tools/e2e.mjs                         # gameplay with real mouse/keyboard
node tools/e2e-touch.mjs                   # iPad-style touch: joystick, buttons, painting, two thumbs (W=… H=… for other sizes)
node tools/e2e-mp.mjs chromium webkit      # two real browsers playing together (add `cloud` for the real PeerJS server)
node tools/e2e-manual.mjs chromium chromium  # serverless copy/paste pairing
node tools/e2e-invite.mjs chromium webkit    # the invite-link flow a partner uses (name, approval, auto-join next time)
node tools/e2e-zoom.mjs                    # page zoom is impossible (pinch, double-tap, focus-zoom, shortcuts) and the picture never jumps
node tools/e2e-relay.mjs chromium webkit     # the encrypted backup relay through the real public brokers (needs internet)
node tools/perf.mjs 4                      # stress scene under CPU throttling
node tools/screens.mjs                     # screenshots of every menu at iPad/Mac sizes
node tools/live.mjs webkit                 # smoke test of the deployed site
```

Architecture notes live in [NOTES.md](NOTES.md). Pushing to `main` runs the tests and deploys to GitHub Pages.

## Credits

* Font: [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL Open Font License 1.1, see `assets/fonts/OFL.txt`)
* Networking: [PeerJS](https://peerjs.com) (MIT) over WebRTC
