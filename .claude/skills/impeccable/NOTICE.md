# Impeccable — vendored third-party skill

This directory is a verbatim copy of the Claude Code build of the **Impeccable**
skill. It is **not** maintained in this repository — do not edit files here.
Update it by re-copying from upstream (see below).

| | |
|---|---|
| Upstream | https://github.com/pbakaus/impeccable |
| Author | Paul Bakaus |
| Homepage | https://impeccable.style |
| Skill version | 4.2.2 (engine `scripts/VERSION`: 0.1.3) |
| Vendored from commit | `44e825090eabd187e003920ac9907737a5b97119` |
| Source path upstream | `.claude/skills/impeccable/` |
| License | Apache License 2.0 (see `LICENSE`) |

The companion subagents ship alongside the skill in this repository's
`.claude/agents/` (`impeccable-finish-reviewer`, `impeccable-documenter`,
`impeccable-asset-producer`, `impeccable-manual-edit-applier`), copied from
upstream `.claude/agents/`. Without them the skill falls back to the in-thread
passes in `reference/degraded/`.

## Updating

```bash
git clone --depth 1 https://github.com/pbakaus/impeccable.git /tmp/impeccable
rm -rf .claude/skills/impeccable
cp -a /tmp/impeccable/.claude/skills/impeccable .claude/skills/impeccable
cp -a /tmp/impeccable/LICENSE .claude/skills/impeccable/LICENSE
cp -a /tmp/impeccable/.claude/agents/. .claude/agents/
```

Then restore this file and update the version/commit above.

## Runtime note

`scripts/impeccable` is a launcher: it runs a self-contained `impeccable-engine`
binary shipped next to it or downloaded once on first run (no Node required).
The skill works without the launcher — it degrades to reading `PRODUCT.md` /
`DESIGN.md` directly and reports that context loading did not run.

## Upstream third-party notices

Reproduced from the upstream `NOTICE.md`:

> The `reference/ios.md` and `reference/android.md` platform reference files are
> distilled from ehmo's `platform-design-skills` (Apple Human Interface
> Guidelines and Material Design 3 rules), rewritten in Impeccable's voice.
>
> **Original work:** https://github.com/ehmo/platform-design-skills
> **Original license:** MIT
> **Author:** ehmo
