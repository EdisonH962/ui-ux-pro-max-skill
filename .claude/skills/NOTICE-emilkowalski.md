# emilkowalski/skills — vendored third-party skills

These twelve skill directories are a verbatim copy of Emil Kowalski's skill
collection. They are **not** maintained in this repository — do not edit them.
Update by re-copying from upstream (see below).

| | |
|---|---|
| Upstream | https://github.com/emilkowalski/skills |
| Author | Emil Kowalski |
| Homepage | https://animations.dev |
| Vendored from commit | `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` |
| Source path upstream | `skills/` |
| License | MIT (see `LICENSE-emilkowalski`) |

## Vendored directories

| Skill | What it does |
|---|---|
| `animate/` | Build a web animation from scratch |
| `animate-expo/` | Build animations in React Native / Expo |
| `animation-vocabulary/` | Reverse-lookup glossary for motion terms |
| `apple-design/` | Apple's fluid-interface approach, translated to the web |
| `ask-sonner/` | Guide to the Sonner toast library |
| `emil-design-eng/` | Emil Kowalski's UI-polish philosophy |
| `find-animation-opportunities/` | Find places that should animate (read-only) |
| `improve-animations/` | Audit a codebase's motion, produce fix plans (read-only) |
| `pick-ui-library/` | Curated library picks per frontend task |
| `prototype/` | Build UI variants behind a visual picker |
| `review-animations/` | Review motion code against a high craft bar |
| `write-swift/` | Modern Swift (6.x concurrency, API design, testing) |

## Name-collision note

`animate/` shares its name with Impeccable's `animate` sub-command. That is only
a conceptual overlap today — Impeccable's lives at
`/impeccable animate`, not as its own directory. Pinning it
(`.claude/skills/impeccable/scripts/impeccable pin pin animate`) would write
`.claude/skills/animate/` and clobber this skill. Don't pin `animate` while this
collection is vendored here.

## Updating

```bash
git clone --depth 1 https://github.com/emilkowalski/skills.git /tmp/emil-skills
cp -a /tmp/emil-skills/skills/. .claude/skills/
cp -a /tmp/emil-skills/LICENSE .claude/skills/LICENSE-emilkowalski
```

Then update the commit above. Re-copying only overwrites the twelve directories
listed here; it does not touch this repository's own skills.
