# video-shotcraft — vendored third-party skill

Verbatim copy. **Not** maintained here — do not edit.

| | |
|---|---|
| Upstream | https://github.com/Vincentwei1021/video-shotcraft |
| Vendored from commit | `5f047c7cfe10d6616fe59160a750fcfaea510b2e` |
| License | Apache 2.0 (see `LICENSE`) |

Vendored complete except `.git/` and `.github/`: `SKILL.md` references all six
content directories (`assets`, `demos`, `gallery`, `references`, `template`,
`workbench`), so none can be trimmed without breaking it.

## ⚠️ Size

**~55 MB**, by far the largest thing in this repository — 36 MB of it is the
bundled BGM/SFX audio library under `assets/audio/`. Weigh that before this
ships in a published plugin package.

## ⚠️ Language

The skill is written primarily in **Chinese**: `SKILL.md` is bilingual, and all
157 shot recipe cards under `gallery/source/` are Chinese-only. An agent reads
them fine; a human maintainer who does not read Chinese will not be able to
review or extend them directly.

## ⚠️ Runtime requirements

Node plus a **Remotion** project (`npx remotion`), and ffmpeg for the render QA
pass. Three-dimensional shot cards additionally need `three`,
`@react-three/fiber` and `@remotion/three`. Remotion carries its own separate
license — see https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
before commercial use.

## Updating

```bash
git clone --depth 1 https://github.com/Vincentwei1021/video-shotcraft.git /tmp/vsc
rm -rf .claude/skills/video-shotcraft && mkdir .claude/skills/video-shotcraft
(cd /tmp/vsc && tar cf - --exclude=.git --exclude=.github --exclude=.gitignore .) \
  | (cd .claude/skills/video-shotcraft && tar xf -)
```

Then restore this file and update the commit above.
