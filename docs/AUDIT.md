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
