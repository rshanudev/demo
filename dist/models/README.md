# Character models

Put rigged GLB/GLTF characters here and name them in `characters.json`:

```json
{ "batsman": "batsman.glb", "bowler": "bowler.glb" }
```

A role set to `null` (or a file that fails to load) uses the built-in stylised player.

Requirements:
- **Format:** `.glb` (textures embedded), facing +Z, Y up. The game scales each model to the player height and stands it on the ground automatically.
- **Skeleton:** humanoid. Mixamo names (`mixamorig:LeftArm`) and common Blender/Unity/Unreal names (`upper_arm.L`, `upperarm_l`, `LeftUpperArm`) are recognised. Needed bones: upper arm, forearm, hand (both sides), thigh, shin (both sides), head.
- **Animations (optional, recommended):** clips whose names contain `idle`, `run`, `bowl`, `celebrate`/`cheer`/`victory`, `sad`/`defeat`. The bowler uses them when present. The batsman always holds the game's bat with both hands through IK, so his arms follow the shot automatically.
- **Do not include a bat** in the batsman model; the game adds its own and puts both gloves on the handle.
