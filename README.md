# Games

## DRIFTWOOD — a co-op survival roguelike (browser, 1–4 players)

A Muck-inspired **first-person** survival roguelike you can play with a friend straight from a link. Wash ashore
on a procedurally generated island, punch trees, craft up through wood → stone → iron → gold →
obsidian, survive escalating nights, collect stackable powerups from chests, slay the three
biome guardians for their gems, repair the shipwreck and kill what rises when you set sail.

- **Design prompt** (what we took from Muck, what we fixed, what we borrowed from Risk of Rain 2,
  Valheim, Core Keeper, Hades, Don't Starve Together, Deep Rock): [`docs/DESIGN_PROMPT.md`](docs/DESIGN_PROMPT.md)
- **Game source:** [`driftwood/`](driftwood/) — vanilla JS + raw WebGL (first-person, low-poly procedural meshes, heightmapped island, dynamic lighting, sky shader), zero assets (all geometry, icons & sound are procedural), no build step, no libraries except PeerJS for room codes.

### Play

Open `driftwood/index.html` from any static host (see *Hosting* below). No install.

| Key | Action |
|---|---|
| **Mouse** | look (click the game to grab the mouse, Esc to release) |
| **WASD** / arrows | move · **Shift** sprint (stamina) · **Space** jump |
| **Q** | dodge roll (i-frames; extra charges from Feathers) · **Alt+1–4** pick a boon |
| **LMB** | attack / chop / mine / place the held building piece where you look |
| **RMB** | draw bow (hold, release to fire) · raise shield (block; block in the first instant to parry) |
| **E** | interact: open chest, use altar, deposit at the ship, open/close door · **hold E** near a downed friend to revive |
| **F** | quick-eat the best food you carry |
| **1–9** / wheel | hotbar · **Tab** or **I** inventory + crafting · **Enter** chat · **T** ping · **M** mute |

**The loop:** gather → craft a workbench → tools → furnace (iron bars) → anvil (iron/gold/obsidian gear).
**Combat:** LMB swings chain into 3-hit combos (the finisher hits harder); **hold RMB** with a melee weapon for a charged heavy attack, with a bow to draw, with a staff to cast, with a shield to block (block in the first instant to parry).
**Roguelike layer:** kills give XP → every level (and every chest) offers a **pick of 3 boons** (Hades-style; 35+ stackable perks). Weapons drop from chests and bosses with **rarity and random affixes** (Swift, Brutal, Vampiric, Flaming, Frozen, Lucky, Heavy, Keen, Cursed). Elites roam with tripled stats and better loot. Each night after the first rolls a **night event** (Blood Moon, Dead Fog, The Swarm, Smuggler's Night, Long Dark, Champions Rise).
**10 bosses per run:** from night 2 the heavy wave brings a **night boss** — Bonecrusher, the Warden, the Matriarch, Frostmaw, the Lich, the Titan — each dropping a unique legendary weapon (shockwave hammer, shadow-bolt blade, fire-trail fang, executioner's cleaver, parry-wave bulwark, venom bow, freezing maul, chain-lightning staff, quaking gauntlet) and a unique armor piece. The three **altar guardians** (Gronk, the Hollow King, the Cinderwyrm) drop the gems for the ship, and the **Leviathan** guards the way out.
**Between runs — the Camp:** every run, won or lost, earns Shards. Spend them on permanent upgrades (Vitality, Might, Swiftness, Fortune, Endurance, Chest Sense, Sharp Start, Second Chance, Wider Choice, Scholar, Armory) and unlock starting classes (Warrior, Hunter, Builder) through the Castaway Log. Saved in your browser.
Every night spawns waves that scale with the day count *and* elapsed time. Placed torches and
campfires create a claim radius where monsters cannot spawn — build walls and a door so they have to
break in. Kill things for coins, spend coins on chests (grey/green/red/gold), stack the powerups.
Craft each biome's **totem** (meadow / dark forest / volcano), use it at that biome's altar to summon
the guardian, take its gem to the shipwreck with 60 wood, 20 iron bars and 10 rope. Set sail → hold
the dock 90 seconds → kill the Leviathan → victory screen with your day count and seed.

Downed players bleed out for 30 s and can be revived; if everyone is down the run ends. Dead players
wash back ashore at dawn (empty inventory, powerups kept). The seed is always shown — type it in the
lobby to replay an island.

### Multiplayer

Host-authoritative peer-to-peer over WebRTC — **no game server**.

1. Host clicks **Create room**, shares the 5-letter code (or the link `…/index.html?room=CODE`).
2. Friends enter the code under **Join a friend**. Up to 4 players. Friends can join mid-run.
3. If the room server is unreachable (corporate network, blocked WebSocket…), expand **Manual invite**:
   host clicks *Make invite* and sends the text to the friend (Discord etc.), the friend pastes it,
   clicks *Make reply*, sends that back, host pastes it and clicks *Accept reply*. Pure WebRTC, no
   third party at all.

Room codes use the free public [PeerJS](https://peerjs.com) signalling server only for the handshake; all
game traffic is direct between browsers.

### Download (desktop game)

Driftwood also ships as a standalone desktop game, built with Electron from the same single-file bundle:

- **Windows:** `Driftwood-Setup-x.y.z.exe` (one-click installer, adds a Start-menu shortcut) or `Driftwood-Portable-x.y.z.exe` (no install, just run it).
- **macOS:** `Driftwood-x.y.z-mac-universal.dmg` — drag to Applications. First launch: right-click → Open (the app isn't notarised).
- **Linux:** `Driftwood-x.y.z-linux.AppImage` — `chmod +x` then run.
- **Any browser:** `Driftwood-browser.html` — the whole game in one file, double-click to play.

Grab them from the repo's **Releases** page. New releases are built automatically by `.github/workflows/desktop.yml`
whenever a `v*` tag is pushed (or from the Actions tab → "Desktop release" → Run workflow).

Build locally from `desktop/`: `npm install`, then `npm run pack` for portable zips of every platform (no code signing
needed), or `npm run dist` for installers of the platform you're on. Multiplayer works the same as in the browser: host,
share the 5-letter room code, friends join — the networking library is bundled, no CDN required.

### Hosting

It is a static site — anything that serves files works.

**GitHub Pages (recommended, free):** in this repo go to *Settings → Pages*, set *Source* to
"Deploy from a branch", pick the branch and the `/ (root)` folder, save. A minute later the game is at
`https://<user>.github.io/<repo>/driftwood/`. Nothing else to configure — multiplayer needs no backend.

**Single file:** `cd driftwood && node build.js` writes `dist/driftwood.html`, one self-contained page
you can drop on any host (Netlify drop, itch.io, a USB stick…).

**Local:** `cd driftwood && python3 -m http.server 8000` then open http://localhost:8000/ — friends on
your LAN can join with your machine's IP, or over the internet via the room code.

### Characters & art

Players, skeletons and the six humanoid bosses are the CC0 **RobotExpressive** rig (tinted per player / boss), wolves and Frostmaw
use the flat-shaded **Fox** rig, goblins and scout drones use Kenney's kit characters. Every model is loaded by the in-house
glTF loader (`js/gltf.js`) with idle / walk / run / attack / death clips crossfaded from the simulation state, and weapons are
attached to the palm bone. Swap or add models by dropping a `.glb` into `driftwood/assets/` and editing `assets/models.json`.

### Code map

```
driftwood/
  index.html      shell + lobby/HUD markup
  style.css
  js/util.js      seeded RNG, value noise, math
  js/data.js      tiles, items, recipes, world objects, powerups, enemies, boat cost
  js/world.js     island generation (noise + biomes + altars + chests), collision queries
  js/sim.js       authoritative simulation: players, combat, harvesting, crafting, building, chests, boat
  js/enemies.js   enemy AI, spawning/waves/claims, 3 guardians + Leviathan
  js/net.js       PeerJS rooms + manual WebRTC fallback, chunked JSON transport
  js/sprites.js   procedural pixel-art sprite generation
  js/gltf.js      minimal glTF/GLB loader: node animation with crossfades, CPU skinning, embedded textures
  js/render3d.js  first-person WebGL renderer: heightmap terrain chunks, glTF characters, 16 point lights, fog, overlay HUD, minimap
  assets/         character models (CC0 / CC-BY, see assets/LICENSES.md) + models.json mapping roles → files, scale, facing, weapon hand, clips
  js/audio.js     WebAudio synthesised SFX and ambient
  js/input.js     pointer-lock mouse look, WASD relative to view, discrete actions
  js/ui.js        lobby, HUD, inventory/crafting, chat, end screen
  js/main.js      game loop, host/client sync, prediction/interpolation
  vendor/         bundled PeerJS (MIT)
  build.js        bundles everything (models, PeerJS embedded) into dist/driftwood.html
desktop/          Electron shell: main.js, pack.js (portable zips), electron-builder.yml (installers), icon generator
```
