# DRIFTWOOD — Design Prompt

> A build prompt for a browser-based, **first-person**, 2-4 player online co-op survival roguelike that takes
> the core loop of **Muck** and fixes what players consistently say is wrong with it, borrowing
> the best ideas from **Risk of Rain 2**, **Valheim**, **Core Keeper**, **Don't Starve Together**,
> **Hades** and **Deep Rock Galactic**.

---

## 1. What Muck gets right (keep this)

Muck (Dani, 2021, free on Steam) is a survival roguelike on a procedurally generated island.
Its loop is tight and immediately readable:

- **Gather → craft → survive the night → get stronger → repeat.** Every night spawns waves of
  enemies that scale with the day counter. Days are short, so pressure is constant.
- **Stackable powerups from chests** (Risk of Rain style). Killing enemies drops coins; coins
  open chests; chests give items that stack multiplicatively. Builds get absurd and that's the fun.
- **Bosses gate progression.** Guardian bosses drop gems; gems repair the boat; the boat is the
  win condition (final ambush fight, then a victory screen with your day count).
- **Runs are 30-60 minutes.** Long enough to matter, short enough to instantly "one more run".
- **Co-op is the point.** Up to 8 players, shared island, shared chests.

## 2. What players say is wrong with Muck (fix this)

Collected from Steam / Metacritic / community reviews:

| Complaint | Our fix |
|---|---|
| Building is useless — enemies spawn inside your walls and shred them instantly. | Enemies **only spawn outside lit/claimed areas**. Placed torches and campfires create a *claim radius*; walls have real HP and block pathing; enemies must break through a wall/door, giving defense a purpose. |
| Bosses one-shot you even in max gear; difficulty feels unfair rather than hard. | Every enemy attack has a **readable wind-up tell** (Hades style), damage is capped at 60% of max HP per hit, and there's an **i-frame dodge roll**. Hard but fair. |
| Death is instant and the run ends for you while friends keep playing. | **Downed state** (Deep Rock / Valheim style): you bleed out over 30s and a teammate can revive you. Full death only if nobody reaches you. Party wipes end the run. |
| Gets repetitive after an hour; not enough content. | 3 distinct **biomes** on every island (meadow, dark forest, volcanic rock), 3 unique bosses with different fight patterns, 20+ stackable powerups with real synergies, and a **final escape sequence**. |
| Texture pop-in / performance jank. | Low-poly first-person world rendered with raw WebGL at a reduced internal resolution, with a fixed 3-chunk view radius and fog instead of pop-in — runs on anything with a browser. |
| No visible seed / no replayability control. | **Seed is always shown** and can be typed in the lobby. Same seed = same island. |
| Solo pacing forces you to ignore building entirely. | Slightly longer days, plus **nights escalate in two phases** (light wave → heavy wave), so there is a beat to fortify. |

## 3. What we steal from other games

- **Risk of Rain 2** — stackable items with escalating power; items shown as icon stacks under
  your health bar; rarity tiers (common / uncommon / rare / legendary) with colored chests;
  a difficulty meter that ticks up over time regardless of what you do.
- **Hades** — combat *juice*: hit-stop, screen shake on big hits, knockback, floating damage
  numbers, telegraphed attacks, dash with invulnerability frames.
- **Valheim** — food buffs (eat 2 different foods for stacked max HP / stamina), stamina-gated
  sprint & attacks, workbench requirement to build, "resting" near fire regenerates faster.
- **Core Keeper** — top-down pixel art readability, tile-based building, ore veins as visual
  clusters in the ground, glowing objects lit in the dark.
- **Don't Starve Together** — darkness is dangerous (you take damage in total darkness without
  a light source nearby), day/dusk/night with a visible clock, torches matter.
- **Deep Rock Galactic** — revive teammates, shout pings, loot is shared and instanced (a chest
  opened by one player gives each nearby player a roll).

## 4. Target experience

**One sentence:** *You and a friend wash up on an island with nothing, and 40 minutes later
you are two absurdly overpowered gods desperately holding a wall together against a screaming
horde while the boat you're repairing is 80% done.*

- Platform: **browser**, desktop keyboard + mouse, **first-person** like Muck. No install. Open a link, share a room code.
- Netcode: **host-authoritative**. One player is the host (server logic runs in their tab);
  clients send input, receive state snapshots. Peer-to-peer over WebRTC so there's no backend
  to pay for. Manual copy-paste signalling as a fallback when the signalling server is blocked.
- Players: **1-4**.
- Run length target: **30-50 minutes** to win, permadeath per run.

## 5. World

- Island **160×160 tiles**; one tile is one world unit (roughly 1.5 m). The heightmap that shapes the
  island also gives the 3D terrain its hills, beaches and seabed; the camera rides at eye height
  above it. Rendered at ~60% internal resolution and upscaled with nearest-neighbour for a chunky look.
- Generated from a **seed** with layered value noise + radial falloff (island shape) and a
  second noise for biome.
- Tiles: deep water, shallow water, sand, grass, dark grass (forest floor), dirt, stone, obsidian
  (volcanic), lava (damages), snow (optional 4th biome).
- Objects (harvestable, have HP, drop resources):
  - Trees (wood, sticks), Birch (forest biome, more wood), Dead tree (volcanic, charcoal)
  - Rock (stone), Iron vein (iron ore, needs stone pickaxe+), Gold vein (gold, needs iron
    pickaxe+), Obsidian vein (volcanic, needs gold pickaxe), Coal rock
  - Berry bush (berries, regrows), Mushroom (forest), Wheat (meadow), Cactus (sand)
  - Chests (see §8), Boss altars (one per biome), the **Boat wreck** on the starting beach.
- **Day/night cycle**: 1 day = 4 min real time (2:40 day, 0:20 dusk, 1:00 night). Night 1 is
  tutorial-easy. Difficulty tier increases every night AND slowly with elapsed time.
- Lighting: a darkness overlay whose alpha follows the clock; light sources (torch, campfire,
  lava, glowing ore, player-held torch) punch soft radial holes in it. Total darkness deals
  1 HP/s ("the dark bites").

## 6. Player

- Stats: HP 100, Stamina 100, Hunger 100 (drains ~1 per 4s; at 0 you lose HP instead of
  regen), Speed, Attack, Defense, Crit chance, Luck.
- Controls: mouse look (pointer lock), WASD move relative to view, Shift sprint (stamina),
  Space jump, **Q dodge roll** (i-frames 0.25s, costs stamina), LMB use/attack where you look,
  RMB secondary (bow aim/charge, shield block), E interact, F eat/quick-consume, 1-9 hotbar,
  Tab/I inventory + crafting, T ping where you look, Enter chat, M mute.
- Inventory: 24 slots + 9 hotbar + armor (head/chest/legs/feet) + 1 accessory. Stacks of 99.
- Hands: tools (axe, pickaxe) and weapons are the same "held item" slot. Tool tier gates
  which resources you can break.

## 7. Combat

- **Melee** (sword, axe, spear, hammer): directional swing arc toward the mouse; each weapon
  has speed, reach, arc width, knockback and a 3-hit combo whose third hit is 1.5× damage.
  Attack cancels on dodge.
- **Ranged** (bow, crossbow): hold RMB to draw (0-1.2s), release to fire; damage and speed scale
  with draw. Arrows are consumable (craft from sticks + stone/iron).
- **Blocking**: shields on RMB reduce damage 70%, drain stamina per block, and a perfect block
  (first 0.15s) staggers the attacker.
- **Juice**: hit-stop 60ms on hit, screen shake scaled by damage, white flash on hit entity,
  floating damage numbers (crit = larger, yellow), blood/particle burst, knockback.
- Damage formula: `dmg = base × (1 + attackBonus) × critMult` reduced by `defense/(defense+50)`.

## 8. Progression & Items

**Tiers:** Wood → Stone → Iron → Gold → Obsidian (each: pickaxe, axe, sword, armor set).

**Stations:** Workbench (wood tools, basic building), Furnace (smelt ore into bars), Anvil
(metal gear), Cauldron (cooked food, potions), Fletching table (bows/arrows).

**Food:** raw berries (+5 hunger), mushroom, cooked meat, bread, stew (Valheim-style: eating
two different "good" foods gives +max HP and +stamina regen buffs that last several minutes).

**Chests & powerups (RoR2 style):** enemies drop coins. Chests cost coins (cost scales with
day). Opening a chest gives every player within 6 tiles a roll from that rarity table.
Four rarities: Common (grey), Uncommon (green), Rare (red), Legendary (gold). Items stack.
Starter list (24 items):

| Item | Rarity | Effect per stack |
|---|---|---|
| Sneakers | C | +12% move speed |
| Whetstone | C | +10% attack |
| Iron Skin | C | +6 defense |
| Broth | C | +15 max HP |
| Feather | C | +1 extra dodge charge |
| Lucky Coin | C | +10% coin drops |
| Bandage | C | regen +0.5 HP/s |
| Sundial | U | night 12% shorter (caps at 50%) |
| Berserker Horn | U | +30% attack when below 40% HP |
| Vampire Fang | U | 8% lifesteal |
| Crit Lens | U | +10% crit chance |
| Magnet | U | pickup radius +2 tiles |
| Sprinter's Wrap | U | sprint costs 30% less stamina |
| Thorns | U | reflect 20% melee damage |
| Blast Cap | R | 15% chance hits explode (AoE 1.5 tiles) |
| Chain Lightning | R | 10% chance hit arcs to 3 enemies |
| Frost Edge | R | hits slow enemies 30% for 2s |
| Second Wind | R | on lethal damage, survive at 1 HP (60s cooldown) |
| Phoenix Feather | L | revive yourself once per run |
| Midas Glove | L | enemies drop 2× coins, chests 20% cheaper |
| Wolf Pack | L | summon a wolf companion that fights |
| Time Shard | L | on dodge, nearby enemies frozen 1s |
| Gluttony | L | food gives 2× and never spoils |
| Warlord's Crown | L | +50% attack, +50% damage taken |

## 8b. Roguelike layer (added in the second pass)

- **XP & boons.** Kills grant XP to every living player; each level-up and every opened chest offers a
  Hades-style *pick of 3* (4 with the Camp upgrade) from the perk pool, rarity-weighted. The game keeps
  running while you choose; auto-pick after 25 s. Perk pool grows to 35+ (Backstab, Heavy Hitter,
  Finisher, Split Shot, Ember Aura, Scavenger, Iron Lungs, Treasure Sense, Glass Cannon, Last Word…).
- **Weapon loot.** Chests (and every boss) drop weapons with a rarity and 0–3 random affixes: Swift,
  Brutal, Vampiric, Flaming, Frozen, Lucky, Heavy, Keen, Cursed. New weapon classes: daggers (fast,
  crit), greatswords (slow, wide), crossbow (pierces), staffs (RMB casts fire/ice bolts). Heavy
  attacks (hold RMB) and 3-hit combos on every melee weapon.
- **Ten bosses per run.** Nights 2–7 each end with a *night boss* in fixed order — Bonecrusher (giant
  skeleton, summons), the Warden (shielded knight, charges), the Matriarch (spider, webs slow you,
  spiderlings), Frostmaw (ice wolf, breath cone, howls for wolves), the Lich (volleys, blinks, drains,
  raises dead), the Titan (stomp quake, boulder barrage) — plus the 3 altar guardians and the Leviathan.
  Every boss drops a **unique legendary weapon with a special** and a **unique armor piece/trinket**
  (Wyrmscale Plate: fire immunity; Crown of the Hollow King: +2 dodges, dark can't bite; Wardenplate:
  35% thorns; Silkweave Leggings: +25% speed; Frostmaw Greaves: frost aura; Titan Visor…). A fourth
  equipment slot, the trinket, carries craftable and boss trinkets.
- **Elites** spawn with 2.5× HP, 1.4× damage, an aura, triple coins and a weapon drop chance.
- **Night events** roll each dusk from night 2: Blood Moon, Dead Fog, The Swarm, Smuggler's Night,
  Long Dark, Champions Rise.
- **The Camp (meta-progression).** After every run — win or lose — players land in the Camp with
  Shards earned from days survived, bosses slain, kills and level. Permanent upgrades: Vitality,
  Might, Swiftness, Fortune, Endurance, Chest Sense, Sharp Start, Second Chance, Wider Choice,
  Scholar, Armory. Starting classes (Castaway, Warrior, Hunter, Builder) unlock via the Castaway Log.
  Saved per browser; each player's meta travels with them into a friend's hosted game.

## 9. Enemies

Enemy stats scale with `difficulty = 1 + 0.35 × night + 0.02 × minutesElapsed`.

| Enemy | Where/When | Behaviour |
|---|---|---|
| Slime | any, night 1+ | bounces toward you, splits once on death |
| Goblin | meadow, night 1+ | fast, weak, swarms |
| Goblin Archer | meadow, night 3+ | keeps distance, shoots |
| Wolf | forest, dusk+ | circles then lunges (tell: crouch 0.5s) |
| Treant | forest, night 4+ | slow, huge, ground-slam AoE (tell: raises arms) |
| Skeleton | anywhere, night 5+ | shield-carrier, blocks frontal hits |
| Magma Crawler | volcanic, always | spits lava globs that leave burning puddles |
| Bat swarm | night, anywhere | erratic, chips at you, dies to any hit |

**Bosses** (each guards an altar in their biome; activate the altar with a crafted key item):

1. **Gronk, the Meadow Ogre** — club slam (AoE), boulder throw, charge. Drops the **Emerald Gem**.
2. **The Hollow King** (forest) — summons skeletons, teleports, arrow volley, dark nova. **Sapphire Gem**.
3. **Cinderwyrm** (volcanic) — burrows, erupts, lava breath cone, spawns crawlers. **Ruby Gem**.

Set all 3 gems into the boat wreck (plus 60 wood, 20 iron bars, 10 rope) to repair it. Sailing
triggers the **final wave**: a 90-second siege at the dock followed by the final boss,
**Leviathan** — tentacles rise from the water around the dock. Kill it → victory screen
(days survived, time, kills, items, seed, "play again with same seed").

## 10. Building

- Tiles snap to the grid; requires a nearby Workbench (Valheim). Pieces: wooden wall (60 HP),
  stone wall (200), door (players open, enemies must break), floor/bridge (walk over shallow
  water), torch, campfire (light + cooking + resting regen), spike trap, wooden fence, chest
  (storage, shared), bed (sets respawn point — respawning is only between nights and costs a
  chunk of coins, to keep runs tense).
- Placed light sources define a **claim radius** where enemies cannot spawn.

## 11. Multiplayer

- Lobby screen: name, colour, **Host** (shows 4-letter room code + seed) or **Join** (enter code).
- Host runs the authoritative simulation at 30 Hz, broadcasts delta snapshots 15 Hz, clients
  send inputs 30 Hz and locally predict their own movement (simple reconciliation).
- Chat, pings (T), shared coin pool option, downed/revive, shared victory.
- If the WebRTC signalling server is unreachable, an **offline code exchange** panel lets the
  host copy an offer string, the friend paste it and reply with an answer string (e.g. over
  Discord). No backend required.

## 12. Presentation

- First-person, low-poly: heightmapped terrain with baked sun shading, water plane, procedurally
  drawn pixel-art sprites (no external assets) used as billboards for creatures, items and
  props, crossed quads for trees, real blocks for walls and doors. Up to 16 dynamic point lights
  (torches, campfires, lava, held torches) plus distance fog whose colour follows the sky through
  day, dusk and night; sun and moon arc overhead, stars come out at night.
- First-person hands: the held item bobs when walking, swings on attack, draws back on a bow.
- HUD: HP / stamina / hunger bars top-left, powerup icon stack below, hotbar bottom-center,
  day counter + clock top-center, minimap top-right, chat bottom-left.
- Procedural WebAudio SFX (hit, swing, chop, pickup, chest, hurt, boss roar) and a light
  procedural ambient drone that darkens at night.

## 13. Technical constraints for the build

- Vanilla JS + raw WebGL 1 (no three.js), no framework, no build step required to run (plain `<script>` tags
  sharing a `G` namespace). A tiny Node script may bundle everything into one HTML for
  single-file hosting.
- Deterministic seeded RNG for world gen; host-side RNG for gameplay.
- Must run at 60 fps in Chrome/Firefox/Edge on a mid-range laptop.
- Must be hostable on **GitHub Pages** (static) — multiplayer needs no server.
- Code split by concern: `world.js`, `entities.js`, `items.js`, `combat.js`, `net.js`,
  `render.js`, `ui.js`, `audio.js`, `main.js`.
- Include a `README.md` with controls, how to host a room, and how to deploy.

## 14. Definition of done

1. Two browsers can join the same room and see each other move, fight, gather and build.
2. A full run is completable: gather → craft tiers → kill 3 bosses → repair boat → final boss → win.
3. Nights get harder; a careless player dies; a careful duo wins around day 8-12.
4. Every complaint in §2 is addressed and visible in play.
5. Zero external assets; one link to play.


## 8c. Art direction update — "Gamble With Your Friends" look (v3)

Reference: *Gamble With Your Friends* (TEAM GWYF, 2026) — first-person, caricatured chunky avatars with big heads, saturated
colours, toon shading, neon casino lighting, hats and cosmetics, slapstick physics. Research notes: `GWF_RESEARCH.md`.

Translation into Driftwood without touching the survival loop:
- Characters: players are procedural non-human 'castaway blobs' (paint-coloured capsule body, googly eyes, reactive mouth/brows,
  stubby legs, mitten arms) with five faces and unlockable hats — the party-game avatar language of GWYF/PEAK rather than realistic
  humans. Tinted KayKit Adventurers/Skeletons (CC0) for humanoid enemies and bosses.
- Rendering: 3-band cel lighting + rim light, stepped point-light falloff, depth-based dark outlines, FXAA-lite, vignette and
  saturation grade in one post pass; pulsing neon pink/cyan lights on casino cabinets at night.
- Gambling layer ("The Dealer's Table"): slots, dice duel, Wheel of Fates (skill/boon rarities with public odds), blackjack;
  wins pay coins and boons, jackpots unlock hats, busts hex; four one-use odds riggers (sketchy items). Host-authoritative.
- Onboarding: a tutorial checklist bound to the player's actual keys, and a How-to-play panel.
- Feel: bigger island (256², main landmass detection so spawn/altars share one connected coast), natural objects keep a walkable gap, round trunk collision so you slide past trees; enemies drawn ~20% smaller than before while their hit radii stay the same.
- World props: KayKit Medieval Hexagon trees/rocks baked to coloured triangles so the environment shares the characters' palette; lobby character preview; cheer emote; hit flinch.
