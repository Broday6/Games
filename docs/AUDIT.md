# Launch audit — what was found, what was fixed, what is left

Three audits were run over the code (combat feel & animation, UI/UX & launch readiness, performance/smoothness/robustness) and
measured in a headless browser (frame time, allocations per frame, chunk build cost, bot playtests). This is the summary.

## Measured before → after

| Metric | Before | After |
|---|---|---|
| Float32Array allocations per frame | 291 | 84 |
| Cost of one tile change (tree broken) | 8.3 ms, up to 6 chunks rebuilt | ~2 ms, one chunk's object buffer |
| Frame stall crossing a chunk border | up to ~140 ms (7 chunks built synchronously) | ≤ 5 ms budget per frame, nearest first |
| Bot "stuck" samples (random-walk playtest) | 9% | 2–4% |
| Hit flash on textured enemies | none (white × texture = texture) | 85% white mix, plus squash |

## Fixed in this round

**Combat feel** — crosshair hit marker / crit / kill X; enemy flash via a `uFlash` uniform and hit squash; client-side flash latch off damage
events (the snapshot bit was too coarse); HUD float stack for self-directed text; directional damage arc; parry white flash and block kick;
enemy `wind → strike (120 ms, damage at 60 ms) → cool`; knockback ×2.5 with slower decay; 0.35 s i-frames after melee mob hits; smooth
2-D camera shake scaled by damage; hand stride sway and item-switch animation; sprint FOV 4°; bow release kick; corpses hold longer;
level-up, nightfall and dawn banners; audio distance falloff + stereo pan, footsteps per surface, heartbeat, reel tick, volume.

**Smoothness** — budgeted chunk streaming with object-only rebuilds and per-chunk corner caches; host-side interpolation of every
entity between sim steps; movement acceleration mirrored in prediction; analytic push-out for round colliders; sky drawn after the
opaque pass; hex() memoised; light/ghost buffers reused; frame-rate independent capped particles; object re-hash only on world change;
mouse sensitivity normalised by FOV.

**Robustness** — post-target textures freed on resize (was leaking on every resize and auto-quality step), debounced resize, WebGL
context loss/restore, error boundary panel, WebGL-unsupported panel, host-lost modal, clipboard failure handling, host button recovers
from a failed room, background-tab auto-pause in solo, pointer-lock failure hint, Esc toggles the menu.

**UI** — credits & licences screen (CC-BY requirement) bundled into every build; version string; settings for volume, HUD scale, FPS,
reduced motion, fullscreen; prompts use real binds; boon picks use physical digit keys (Option+1 on macOS); boss bars moved below the
clock; compass strip; minimap casino markers and north; party roster; low stamina/food pulses and a starving toast; boon timer bar and
ticks; recipe click explains what is missing; inventory hotbar row labelled; run summary before the Camp; quit confirmation; rare items
blue instead of damage-red; tutorial casino step works for joined clients (`gambles` in the snapshot).

## Known backlog (not launch-blocking)

- Networking: snapshots are still full JSON at 15 Hz with a blind reconciliation lerp. Delta encoding, an unreliable channel for state and
  input-sequence replay would remove the remaining soft rubber-band at 100 ms+ RTT.
- Rendering: no VAOs (about 1,400 attribute calls per frame), `bufferData` reallocates the dynamic store each frame, chunks are never
  evicted (a full traverse holds all 256), and world matrices are re-allocated per model node per frame.
- Content: no music beyond the ambient drone; wolves and the drone have no attack/death clips (synthesised poses would help); enemy
  wind-up telegraphs on glTF models are the 2-D "!" only.
- UX: buff icons are text; no colour-blind palette; the jump is cosmetic (not networked); slopes are decorative (no speed effect).

## Round 3 (post-launch polish)

- **Post-hit judder fixed.** The camera kick re-armed every frame while the 150 ms hit flash lasted (kick fell below its re-arm threshold in
  ~37 ms), so one hit produced four rapid pitch jerks. It now fires once, on the rising edge of the flash; shake is smaller and decays faster.
- **Casino odds are public and payouts scale with rarity.** Slots pay per symbol (×3 cherries → ×200 sevens) with the return-to-player
  printed; Dice Duel has four bet modes with payouts computed from the exact 2d6 outcome table; the Wheel's coin segment pays more on the
  tiers where it is rarer; blackjack lists its odds.
- **Icons, tooltips, items.** 32-px shaded icons for every item; tooltips with DPS and comparison against held/worn gear; Bandage.
- **Feel.** Enemies ramp red through the wind-up on glTF rigs too; drops are pulled in from further away.
- **Smoothness.** VAOs for chunk draws, bufferSubData into fixed stores, chunk eviction after 15 s unseen, pooled model world matrices,
  and prefab instancing that writes straight into the chunk array: a tree break went from ~270 ms to ~4 ms, a cold 35-chunk build from
  ~950 ms to ~100 ms.

## Round 4 (dropping, storage, playing online from the web)

- **Dropping.** `X` drops one of the held item, `Shift+X` the whole stack (over a bag slot while the inventory is open it drops that
  slot). In the bag: Ctrl-click drops one, Shift-click the stack, or pick a stack up and click the dashed drop bar. Drops are thrown
  in the facing direction with a short arc and remember who threw them: the pickup magnet ignores your own drop until you have walked out
  of range once (or 20 s pass), so dropping something at your feet no longer snaps it straight back into the bag. Weapon affixes and
  rarity survive a drop (they were lost before).
- **Storage Chest.** Placeable (8 wood + 2 sticks, no workbench needed), 18 stacks, opened with the interact key; the panel sits next to
  the bag. Bag click stows, chest click takes, right-click takes one, Take all / Stow matching buttons. Contents live on the world object
  (`o.inv`) so they are shared by the party and synced through the normal object-change stream; breaking the chest spills everything.
  The bag + chest + crafting columns scale down to fit narrow windows instead of overlapping.
- **Rendering bug found on the way.** Chunk object signatures were only recorded on the first *scan after* a world change, so the very
  first object change of a session (the first tree felled, the first thing built) left the chunk mesh stale until a second change happened.
  Signatures are now recorded when a chunk is built.
- **Online play from the web.** The claude.ai preview runs inside a sandbox whose content-security policy blocks the PeerJS signalling
  WebSocket, so room codes cannot connect there. Publishing the artifact with the `room`/`db` capabilities would have made it
  organisation-internal and unshareable, so the preview instead explains itself and links to the hosted copy. The GitHub Pages workflow
  had failed on every push (`configure-pages` may not enable Pages with the workflow token); it now stages only the site files, tries the
  official Pages actions and falls back to publishing a `gh-pages` branch. The lobby gained **Copy invite link**
  (`…/driftwood/?room=CODE`, which pre-fills the Join tab), the bundle bakes the public URL in for links from `file://` and the preview,
  and Google STUN is joined by the free Open Relay TURN servers so strict-NAT players connect through a relay.

## Round 5 (manual pickup, linked chests, servers)

- **Pickup is deliberate now.** Items stay where they fall; the interact key (or the eat key, when a drop is at your feet) picks
  up the nearest drop and anything piled within a tile of it, with the hint naming what you would grab. Coins keep the magnet.
  The owner rule from round 4 became unnecessary and was removed from the pickup loop.
- **Linked chests.** Storage chests within two tiles of each other form one store (`G.chestNetwork`, shared by sim and UI).
  Stowing tops up an existing stack anywhere in the network before using a free slot, so chests standing together sort
  themselves by item; *Stow matching* considers the whole network; *Sort* merges partial stacks and lays everything out grouped
  by type, tier and name across the chests in order. The panel shows a tab per linked chest.
- **Servers.** `wsserver.js` is a dependency-free WebSocket server (RFC 6455 framing, ping/pong, fragmentation, static files
  with an HTML injection hook). `server.js` loads util/data/world/sim/enemies into Node with `vm.runInThisContext` (the game
  rules never touch the DOM), runs the island headless, speaks the same `hello / welcome / start / in / act / snap / ev`
  protocol as a browser host, adds `kick` for password/full-server refusals, and serves the game page with the address
  pre-filled. The desktop app runs the same module in its main process behind a preload bridge (`window.driftwoodNative`), so
  "Host on this computer" opens a port next to the room code. The client got `Net.connect(addr)` (whole JSON messages, no
  chunking) and a *Server address* field; `?server=host:port` and the injected `__SERVER_ADDR` flag pre-fill it.
- **Limits stated in the lobby and README.** Plain `ws://` cannot be reached from the https-hosted page (mixed content), and
  internet play through a port still needs port forwarding or a tunnel — the room code remains the no-configuration path.
