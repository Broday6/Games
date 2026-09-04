# Third-party assets

- `kk_knight.glb`, `kk_barbarian.glb`, `kk_mage.glb`, `kk_rogue.glb`, `kk_rogue_hooded.glb` — **KayKit Adventurers Character Pack 1.0** by Kay Lousberg (www.kaylousberg.com). **CC0 1.0**.
  Used for the playable characters and (tinted) for goblins, the Warden, Gronk and the Titan.
  Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- `kk_skeleton_minion.glb`, `kk_skeleton_warrior.glb`, `kk_skeleton_rogue.glb`, `kk_skeleton_mage.glb` — **KayKit Skeletons Character Pack 1.0** by Kay Lousberg. **CC0 1.0**.
  Used for skeletons, Bonecrusher, the Hollow King and the Lich.
  Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
  All KayKit files are slimmed with `tools/slimglb.js` (kept animations only, pack weapons removed, keys resampled to 15 fps).
  Support Kay on Patreon: http://patreon.com/kaylousberg
- `fox.glb` — "Fox" by PixelMannen (model), tomkranis (rigging & animation), glTF conversion by @AsoboStudio and @scurest.
  **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). Used flat-shaded and tinted for wolves and Frostmaw.
  Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
- `kenney_character.glb`, `kenney_blaster.glb`, `kenney_drone.glb` — from Kenney's Starter Kit 3D Platformer / Starter Kit FPS.
  **MIT** (code) / **CC0** (assets). The drone is the scout-drone enemy.
  Source: https://github.com/KenneyNL/Starter-Kit-3D-Platformer , https://github.com/KenneyNL/Starter-Kit-FPS
- `robot.glb` — "RobotExpressive" by Tomás Laulhé (Quaternius), modifications by Don McCurdy. **CC0 1.0**. Kept as an optional look.
  Source: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive

Drop any other `.glb` into this folder and reference it from `assets/models.json` (key = `player_<skin>` or an enemy id) to use it in-game.
Each entry takes: `file`, `height` (metres), `yaw` (rotation that makes the model face +X), `tint` (material name or `*`) with `tintMode`
(`mul` keeps the texture), `tintNodes` (nodes drawn flat in the player colour), `hide`/`headgear` (nodes hidden always / when a hat is worn),
`flat` (ignore textures), `hover`, `hand`/`handOffset`/`handRot`/`itemScale`/`held` (weapon attachment) and `clips` + `sets`
(idle/walk/run/attack/attackAlt/chop/stab/slam/death/block/dodge/sit → animation names, with per-weapon-kind overrides in `sets`).
