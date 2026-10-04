# Snug Isles 🏝️

A cozy two-player island crafting & building game that runs in the browser — made for **iPad** and **Mac**.

Gather resources, buy new lands, research a big tech tree, and build the house of your dreams (walls, windows, doors, floors, 80+ pieces of furniture, lights and decor) — together, over the internet.

> Inspired by the cozy open-world crafting genre. All art, music and sound in this project are original and generated in code; nothing is taken from any other game.

## Play

Open the site on any modern browser (Safari on iPad, Chrome/Safari on Mac). On iPad: **Share → Add to Home Screen** for a full-screen, offline-capable app.

**Two players:** one of you picks *Play together → Host a world* and reads out the 5-letter room code (or shares the invite link). The other picks *Play together → Join my partner* and types it. Both devices keep a copy of the world, so either of you can host next time.

## Controls

| | Mac | iPad |
|---|---|---|
| Move | `WASD` | left thumb joystick |
| Mine / chop / fight | hold left-click | hold the big button (auto-aims) |
| Interact | `E` / click | hand button / tap things |
| Dash | `Space` | dash button |
| Menus | `I` bag · `C` craft · `B` build · `T` research · `K` skills · `M` map · `G` emote | top-right buttons |
| Build | pick a piece, click/drag; `R` flips, `X` removes | pick a piece, tap/drag; **Rect** fills a whole room |

## Development

```bash
npm install
npm run dev        # build + serve on http://localhost:5173 and rebuild on change
npm test           # simulation, save/load and networking tests (Node)
node tools/e2e.mjs                       # browser gameplay test (Playwright)
node tools/e2e-mp.mjs chromium webkit    # two real browsers playing together
npm run build      # production bundle in dist/
```

Architecture notes live in [NOTES.md](NOTES.md).

## Credits

* Font: [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL Open Font License 1.1, see `assets/fonts/OFL.txt`)
* Networking: [PeerJS](https://peerjs.com) (MIT) over WebRTC
