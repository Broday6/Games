# Muck (Dani, 2021) — movement & gathering feel notes

Numbers below come mostly from the decompiled Unity source (sodiboo/Muck, `Assets/Scripts/Assembly-CSharp/*.cs`,
prefab and .anim YAML). Wiki/guide pages (fandom, Steam, GamePretty, TheGamer) were proxy-blocked; their facts
are quoted from search snippets and marked as such. "Estimated" / "unconfirmed" where noted.

Sources:
- Decompiled source: https://github.com/sodiboo/Muck (PlayerMovement.cs, PlayerStatus.cs, MoveCamera.cs,
  CameraShaker.cs, HitBox.cs, UseInventory.cs, DayCycle.cs, GameSettings.cs, GameManager.cs, HitableResource.cs,
  LootExtra.cs, Item.cs, Hotbar.cs, InventoryUI.cs, CraftingUI.cs, CauldronUI.cs, PlayerSave.cs, MapGenerator.cs,
  PrefabInstance/Tree.prefab, Birch.prefab, Coal.prefab, AnimationClip/Attack.anim, Attack2.anim,
  ScriptableObject/Shake/*.asset, ScriptableObject/Noise/Noise.asset), tool table: docs/Data.md
- Wiki (snippets only): https://muck.fandom.com/wiki/Player_Status , https://muck.fandom.com/wiki/Difficulty ,
  https://muck.fandom.com/wiki/Game_Guide , https://muck.fandom.com/wiki/Workbench , https://muck.fandom.com/wiki/Damage_Calculation
- Day length thread: https://steamcommunity.com/app/1625450/discussions/0/5408241261722759746/ ; mod page
  https://thunderstore.io/c/muck/p/MichMcb/MuckTimeModifier/ ("vanilla speeds time 3.3x at night")
- Guides: https://www.thegamer.com/muck-beginner-tips-survive/ , https://www.gameskinny.com/tips/muck-crafting-recipes-guide/ ,
  https://steamcommunity.com/sharedfiles/filedetails/?id=2956710586 , https://gamepretty.com/muck-guide-wood-rocks-ores-food-powerups-tools/

## 1. Movement (PlayerMovement.cs — Dani's Karlson-style Rigidbody controller)
- Walk cap `maxWalkSpeed = 6.5` u/s; sprint cap `maxRunSpeed = 13` u/s → sprint is exactly **2.0x walk**.
- Drive force `moveSpeed = 3500` on a Rigidbody: you hit the cap in well under a second (~0.2-0.3 s, estimated),
  so starts feel instant. `counterMovement = 0.14` decelerates hard when you release; holding the opposite key
  doubles the braking. Net effect: near-instant start/stop, but with a small physics "skid" — no lerp smoothing.
- Air control: horizontal force multiplied by **0.2** when not grounded; you steer a little, not a lot.
- Jump: `jumpForce = 12`, applied as impulse `up * 12 * 1.5` plus `surfaceNormal * 12 * 0.5` (jumping off a slope
  kicks you outward). Downward velocity is zeroed before the jump so a late jump still gets full height.
  `extraGravity = 5` on top of Unity gravity → snappier, heavier arc. `jumpCooldown = 0.25 s`. Jump height in
  metres: unconfirmed (Rigidbody mass not read); visually ~1.5-2 player heights (estimate).
- Slopes: `maxSlopeAngle = 50°` counts as floor. 50-89° is "surf": you slide down it, can't stand, but can jump off.
  Hills are rolling (Perlin, low persistence) so most terrain is walkable; cliffs/rock outcrops need a jump or a
  route around. Crouch (`slideForce = 800`) gives a Karlson-style slide; camera tilts 6° while crouching.
- Water: `swimSpeed = 50` (force); swimming drains stamina, 0 stamina underwater = drowning damage 5/tick.
- Defaults (PlayerSave.cs): WASD, Space jump, LeftShift sprint, E interact, **Tab inventory**, M map,
  Mouse0 use/attack, Mouse1 build/secondary; FOV **85**; `cameraShake = true`; sensitivity 50 (× 0.02 internally).

## 2. Camera: bob and sway (MoveCamera.cs, CameraShaker.cs, Shake presets)
- **No per-step head bob.** Footsteps only spawn a particle/sound every ~6 world units (`distance > 300`,
  accumulating `velocity*50*dt`). `StepShake` preset (strength 0.56, roughness 9) exists but is not called from
  PlayerMovement — it is for big mobs (unconfirmed).
- **Landing dip only:** `BobOnce(new Vector3(0, fallSpeed, 0))` fires when `fallSpeed < -12` (a real drop, not a
  normal jump). Amplitude = `fallSpeed * 0.15` clamped to ±3, then lerps in at `bobSpeed = 15`/s and decays at
  7.5/s → a ~0.15-0.25 s dip.
- Hit shake is tiny: `DamageShake(0.1 * crit)` on resources, `0.4` on mobs, using preset strength 0.8 / roughness 8 /
  fadeIn 0.05 / fadeOut 0.45, rotation influence 2x position. All shake is one toggle in settings.
- `Handheld` preset (sustained, strength 1.6, roughness 0.06, rot influence y=4) = a very slow idle drift;
  whether it is applied to the player camera is unconfirmed. There is **no sprint FOV kick** anywhere in the code.
- Crouch tilt 6°, lerp 8/s. That is the whole camera feel: static, wide (85°), reacts only to landings and hits.

## 3. Stamina & hunger (PlayerStatus.cs)
- Stamina 100. Sprint drain `12/s` only while `velocity > 5 && sprinting` → 100 stamina = **~8.3 s of sprint**.
- Regen `15/s` only when grounded, not draining, and hunger > 0 → empty to full in **~6.7 s**. No regen delay.
- Jump costs a flat **10** (`CanJump` needs ≥10). `CanRun` only needs stamina > 0, so you can sprint to the last drop.
- Attacks and tool swings cost **no stamina** (nothing in UseInventory/HitBox touches stamina).
- Hunger 100, drains `0.15/s` (~11 min idle), ×5 while sprinting, ×2 while healing. Hunger 0 → no health regen,
  stamina regen ×0.3 (wiki snippet says sprint/jump disabled at 0 hunger — unconfirmed vs code).
- Health regen 5/s while hunger > 0 (adrenaline boost when HP < 30%).

## 4. Swinging & harvesting (UseInventory.cs, HitBox.cs, Data.md, prefabs)
- One "Attack" clip of **1.0 s** at 60 fps, played with animator param `AttackSpeed = item.attackSpeed`; three
  variants (Attack1-3) picked at random. Swing time = `1 / attackSpeed`; you cannot swing again until the clip
  finishes (`IsAnimationPlaying`) — hence the community "quick switch" exploit that resets it.
- The hit lands early: `UseHitbox` animation event at **t = 0.267 s** of the 1 s clip (≈27% in). Then the rest of
  the clip is recovery you can't cancel.
- Tool stats (attackSpeed = swings/s; Resource Damage = per hit on trees/ores):
  Rock 15 / 0.72 (1.39 s swing, hit at 0.37 s) · Wood Axe 20 / 0.9 (1.11 s, hit at 0.30 s) · Wood Pickaxe 18 / 0.8 ·
  Steel Axe 25 / 0.9 · Steel Pickaxe 25 / 0.8 · Gold Axe 22 / 1.1 · Mithril Axe 35 / 0.95 · Adamantite Axe 50 / 1.0 ·
  Steel Sword 25 dmg / 1.3 (0.77 s).
- Hit detection: `SphereCastAll` radius **3 u** from the camera, range `1.2 + item.attackRange + armor bonus`, sorted
  by distance; extra targets take 50% each. Very generous — you rarely whiff a tree.
- Resource HP: **Tree 100 hp** (any tool incl. Rock, drops 10 wood + 20% extra roll), **Birch 200 hp** (tier ≥1,
  drops 5), **Coal 120 hp** (pickaxe). Stone rocks: unconfirmed (probably ~100-150 like Coal).
  → Basic tree: 7 hits with Rock, **5 with Wood Axe**, 4 Steel, 3 Mithril, 2 Adamantite. Birch: 10 Wood Axe, 8 Steel.
- Per-hit feedback: resource punches to **0.7 scale** and lerps back (10-15/s), hit particles, floating damage
  number, small shake, randomized swing SFX (`Randomize(0.15/attackSpeed)`).
- Drops: only on kill (`LootExtra.CheckDrop` when hp ≤ 0). Items spawn stacked at the collider centre, fall with
  physics (no random burst force), are **auto-picked on touch** after `pickupDelay = 0.85 s`, and go straight to the
  hotbar (6 slots, 1-6 or scroll). Rare drops get a red outline + chat line.

## 5. Crafting UI (InventoryUI.cs, CraftingUI.cs, CauldronUI.cs, wiki)
- **Tab** toggles inventory; a crafting panel lives inside it (`InventoryExtensions CraftingUi`) so the Workbench
  itself (10 wood) is crafted from bare inventory, then placed with Mouse1. Right-click in a cell drops one item.
- **E** on a Workbench/Anvil/Fletching Table opens the same tabbed list (Basics / Tools / Build ...). Each recipe
  cell shows the result icon and a row of ingredient icons; recipes you can't afford are drawn at 0.6 alpha
  (still visible, teaching the goal). Only "soft-unlocked" recipes (ingredient seen) appear. **Click = instant
  craft**, no timer, no drag-to-slot.
- Cauldron (10 wood + 10 stone) is different: ingredient cells + fuel cell + result cell, a progress bar and a
  process timer (real cooking). Furnace (15 stone, smelts ore→bars) very likely uses the same fuel/timer UI —
  unconfirmed. Anvil = 5 iron bars + 15 stone; makes armor/weapons/tools.

## 6. Terrain (MapGenerator.cs, Noise.asset, wiki)
- Perlin island: `noiseScale 20, octaves 4, persistence 0.1, lacunarity 6`, minus a radial falloff map, clamped 0-1.
  Persistence 0.1 = almost no high-frequency detail → long smooth hills, occasional steep flanks. Chunk 241,
  `worldScale 12`. Lakes inland, ocean at the edge kills you. Height multiplier lives on a scene component
  (unconfirmed).
- Traversal: walk anything ≤50°, slide off anything steeper, jump (0.25 s cooldown, 10 stamina) to hop ledges and
  rocks. Sprint-jump then release sprint mid-air is the standard stamina trick (guides).

## 7. Day/night pacing (DayCycle.cs, GameSettings.cs, GameManager.cs, Steam thread)
- `GameManager` sets `DayCycle.dayDuration = gameSettings.DayLength()` = **56 Easy / 54 Normal / 52 Gamer**.
  `time` runs 0→1; night is the second half and its rate is divided by `nightDuration` (code default 0.5, players
  report 3.3x). Editor `timeSpeed` not read; players measure a full Normal cycle at **~6 min**, so roughly
  **4.5 min daylight + ~1.3-1.5 min night** (estimated). Not the 4 min sometimes quoted.
- Bosses: Normal from night 4 and 8 then every night; Easy 6/12; Gamer 3+. Chest price ×6 Normal.

## 8. Why it feels snappy (summary)
Instant force-based accel with hard counter-friction; 2x sprint with no FOV/bob theatrics; a wide static 85° camera
that only reacts to landings and hits; tool swings whose hit lands at 27% of the animation with a 3 u sphere cast;
big juicy per-hit feedback (scale punch, particles, numbers) on short 5-hit trees; drops auto-collect and land in
the hotbar; instant click-to-craft with all recipes visible; and 6-minute days that keep you moving.

## Recommendations for Driftwood
1. **Head bob → landing dip only.** Cut walk bob from 0.012/0.016 to ≤0.004 (or 0) and add a one-shot landing dip
   of 0.05-0.10 × fall speed, in over 60 ms, out over 150 ms, only when fall speed > ~1.5× jump-apex speed.
2. **Sprint FOV ≤ +2°** (Muck: 0). Keep the current +2.5 → lower to +1.5-2, lerp 8/s. Raise base FOV to 80-85.
3. **Sprint = 1.8-2.0× walk** (currently 1.5×). Muck: 6.5 → 13 u/s. Pair with 8-9 s of full-sprint stamina
   (drain 12/s is already right) and regen 15/s with **no regen delay**, grounded only.
4. **Acceleration: reach walk speed in ≤0.15 s, stop in ≤0.1 s** (Muck force 3500 + counter 0.14). Kill any long
   ease-in; a 20% air-control multiplier is fine.
5. **Jump cost 10 stamina, 0.25 s cooldown, extra gravity ~1.5× on the way down** so the arc is short and heavy;
   jumping off slopes adds a little outward push.
6. **Swing timing:** clip ≈ 1.0 s ÷ attackSpeed, with the hit at ~27% (0.25-0.35 s for tools, ~0.2 s swords);
   the rest is uncancellable recovery. Tool swings cost **no stamina**. Drop the 0.75× move-speed-while-swinging
   penalty or soften it to 0.9 — Muck has none.
7. **Hit detection: sphere/capsule sweep ~1.5-3 u radius, reach 1.2 + item reach**, sorted by distance, extra targets
   at 50% — generous enough that you never miss a tree you're looking at.
8. **Trees 100 hp, wood axe 20 → 5 hits; rock/fist 15 → 7 hits; tier-2 tree 200 hp.** Ores ~120 hp with a
   pickaxe. Each hit: scale punch to 0.7 and spring back (~0.15 s), particles, damage number, pitch-randomized SFX.
9. **Drops on kill only, auto-pickup on touch after ~0.8 s, go straight to hotbar**; no per-hit drops, no magnet
   needed, tiny burst force (or none) so wood piles where the tree stood.
10. **Crafting: instant click-to-craft from Tab; show unaffordable recipes at 60% alpha with ingredient icons**;
    workbench craftable from raw inventory. Reserve timers/fuel for furnace and cooking pot only.
11. **Terrain: walkable ≤50°, slide 50-89°, low-persistence noise (0.1-0.3)** so hills are long and readable;
    place ledges you must jump. Keep 1-2 walk-arounds per cliff face.
12. **Day pacing: consider 5-6 min per cycle** (~4 min day, 1.2-1.5 min night, night clock running ~3× faster),
    up from the current 4:00 — matches the "slightly longer days so there is a beat to fortify" note in DESIGN_PROMPT.
