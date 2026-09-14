# Vendored game-development skills

Project-scoped skills for the browser shooter in `projects/blitz-brigade-remake/`.
They are **not** part of the `ui-ux-pro-max` product skill or its marketplace plugin —
that is why they live here and not in the repository's root `.claude/skills/`.

## Sources

| Skills | Origin | License |
| --- | --- | --- |
| `threejs-aaa-graphics-builder`, `threejs-gameplay-systems`, `threejs-game-director`, `threejs-game-ui-designer`, `threejs-debug-profiler`, `threejs-qa-release` | [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | MIT |
| `game-feel`, `performance-optimization`, `shader-programming`, `camera-systems`, `game-ai`, `input-systems`, `audio-design`, `level-design`, `threejs-scene-setup`, `threejs-materials-lighting`, `threejs-gltf-loading` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 |
| `multiplayer-netcode` (SKILL.md written for this project, `references/` vendored) | [HermeticOrmus/claude-code-game-development](https://github.com/HermeticOrmus/claude-code-game-development) | MIT |

License texts are kept next to the skills they cover.

## What was deliberately left out

Only reviewed Markdown was vendored. The upstream repositories also ship shell scripts,
Python helpers, agent YAML and a Vite/TypeScript scaffold; none of that was copied, because
executable code from third-party repositories should not enter this repository unreviewed.

Practical consequences:

- `threejs-aaa-graphics-builder` and `threejs-game-director` mention
  `scripts/probe_asset_credentials.sh` and `scripts/check_evidence.py`. Those scripts are absent.
  Asset generation in this project runs through the session's connectors instead, and evidence
  (screenshots, measured frame times) is produced by the project's own Playwright harness.
- `threejs-qa-release` mentions `scripts/inspect-threejs-canvas.mjs`. Absent for the same reason;
  the equivalent checks live in this project's test scripts.
- Upstream skills target three.js `^0.184` with the `three/addons/*` alias. This project vendors
  three.js `0.160` at `vendor/three.module.min.js` and imports it through an import map.
  Verify every recipe against that version before adopting it.

## Updating

The upstream repositories are not submodules. To refresh, clone them again and re-copy the
Markdown only:

```bash
git clone --depth 1 https://github.com/majidmanzarpour/threejs-game-skills
git clone --depth 1 https://github.com/gamedev-skills/awesome-gamedev-agent-skills
git clone --depth 1 https://github.com/HermeticOrmus/claude-code-game-development
```
