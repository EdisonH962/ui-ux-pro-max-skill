# Character models

Drop rigged GLB files here and list them in `manifest.json`. Any class without an entry
keeps its procedural box fighter, so models can be added one class at a time.

## Format

```json
{
  "characters": {
    "soldier": {
      "model": "models/soldier.glb",
      "scale": 1.0,
      "yOffset": 0,
      "rotationY": 0,
      "teamMaterial": "Armor",
      "weaponBone": "RightHand",
      "teamTint": 0.35,
      "clips": {
        "idle":   { "name": "idle" },
        "run":    { "file": "models/soldier_run.glb" },
        "aim":    { "file": "models/soldier_aim.glb" },
        "fire":   { "file": "models/soldier_fire.glb", "loop": "once", "speed": 2 },
        "reload": { "file": "models/soldier_reload.glb", "loop": "once" },
        "death":  { "file": "models/soldier_death.glb", "loop": "once" }
      }
    }
  }
}
```

- `model` — the base mesh. Clips inside this file are picked up by name.
- `clips.<state>.file` — a separate GLB whose **first animation** becomes that state. This
  is the shape most generators produce: one exported file per animation, all sharing the
  same skeleton.
- `clips.<state>.name` — pick a clip by name instead, from the base model or the given file.
- `loop: "once"` for fire, reload and death. `speed` scales playback.
- `teamMaterial` — name of the material that should take the team colour. Without it the
  whole model is tinted slightly towards the team colour (`teamTint`, default 0.35).
- `weaponBone` — bone the weapon is mounted to.

States the game drives: `idle`, `run`, `aim`, plus one-shots `fire`, `reload`, `death`.
Missing states fall back to `idle`, so a partial set still works.

## Budget

Target is a phone. Keep each character at or below **8.000 triangles** and a single
1024² texture set. Twelve fighters are on the map at once; the map itself already costs
about 40.000 triangles and 80 draw calls.

## Fixture

`_fixture/dummy.glb` and `_fixture/dummy_run.glb` are a tiny rigged test dummy generated
by the project's own test tooling. They exist so the loading path (skinned clone, clip
merging from several files, state machine) can be verified without shipping real assets.
