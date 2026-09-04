# Third-party assets

- `robot.glb` — "RobotExpressive" by Tomás Laulhé (Quaternius), modifications by Don McCurdy. **CC0 1.0**.
  Used for players, skeletons and the humanoid bosses (tinted per character).
  Source: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
  Consider supporting the creator: https://www.patreon.com/quaternius
- `fox.glb` — "Fox" by PixelMannen (model), tomkranis (rigging & animation), glTF conversion by @AsoboStudio and @scurest.
  **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). Used flat-shaded and tinted for wolves and Frostmaw.
  Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
- `kenney_character.glb`, `kenney_blaster.glb`, `kenney_drone.glb` — from Kenney's Starter Kit 3D Platformer / Starter Kit FPS.
  **MIT** (code) / **CC0** (assets). Used for goblins and the scout drones.
  Source: https://github.com/KenneyNL/Starter-Kit-3D-Platformer , https://github.com/KenneyNL/Starter-Kit-FPS

Drop any other `.glb` into this folder and reference it from `assets/models.json` (key = `player` or an enemy id) to use it in-game.
Each entry takes: `file`, `height` (metres), `yaw` (rotation that makes the model face +X), `tint` (material name to recolour),
`flat` (ignore textures), `hover` (metres above ground), `hand`/`handOffset`/`handRot`/`itemScale`/`held` (weapon attachment) and `clips`
(idle/walk/run/attack/death → animation names in the file).
