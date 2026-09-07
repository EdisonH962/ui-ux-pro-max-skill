# taste — vendored third-party skill

Verbatim copy of the `/taste` design-DNA extractor. **Not** maintained in this
repository — do not edit. Update by re-copying from upstream.

| | |
|---|---|
| Upstream | https://github.com/senlindesign/taste-skill |
| Author | Senlin |
| Homepage | https://www.tastelab.xyz |
| Skill version | 1.1.0 |
| Vendored from commit | `6dce223f2f5665d3636ca9a44ec3a7aa1322a9b8` |
| License | **See the caveat below** |

## ⚠️ License caveat — unresolved

The upstream README displays a "License: MIT" badge linking to a `LICENSE`
file, **but no such file exists in the repository** — not at the vendored
commit and not anywhere in its git history, so the badge link is broken. The
author's stated intent is clearly MIT, but the license text itself was never
committed, and without it the default is all-rights-reserved.

This copy is vendored on the strength of that stated intent. Before shipping it
to third parties (an npm release, a plugin-marketplace listing), ask the author
to add the `LICENSE` file upstream, then record it here. If the answer is
anything other than MIT, remove this directory.

## What was vendored

Only what the skill needs to run:

- `SKILL.md` — the 4-step pipeline
- `references/` — step1-measure, step2-pattern, step3-taste, step4-observer,
  export-formats, and `extract.js` (the in-page DOM measurement script)
- `README.md` — upstream's own documentation

Deliberately **not** vendored: upstream's `docs/` (a 10 MB marketing landing
page with a `.glb` 3D model and screenshots) and `evals/` (the author's test
fixtures). Neither is referenced by `SKILL.md`. That drops the footprint from
21 MB to ~90 KB.

## ⚠️ Runtime requirement

This skill does not work standalone. It needs the **Playwright MCP server** to
drive a real browser:

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --isolated
```

Without it, `/taste <url>` cannot capture the DOM or screenshot and will fail
at step 1.

## Updating

```bash
git clone --depth 1 https://github.com/senlindesign/taste-skill.git /tmp/taste-skill
cp -a /tmp/taste-skill/SKILL.md /tmp/taste-skill/README.md /tmp/taste-skill/references .claude/skills/taste/
```

Then restore this file and update the commit above.
