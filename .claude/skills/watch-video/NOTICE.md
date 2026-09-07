# watch-video — vendored third-party skill

Verbatim copy. **Not** maintained here — do not edit.

| | |
|---|---|
| Upstream | https://github.com/Newuxtreme/watch-video-skill |
| Vendored from commit | `16313155ba87c22397ed20634766cb0606e2dbaa` |
| License | MIT (see `LICENSE`; the vendored pipeline's own attributions are in `THIRD_PARTY_NOTICES.md`) |

The directory is named `watch-video` to match the skill's frontmatter `name`,
not the upstream repository name.

Upstream's `docs/` (344 KB of screenshots for its README) is not vendored;
`SKILL.md` does not reference it.

## ⚠️ Runtime requirements

- **ffmpeg + ffprobe** on PATH — frame and audio extraction
- **yt-dlp** on PATH — download and caption fetching
- Optional: `GROQ_API_KEY` or `OPENAI_API_KEY` in `~/.config/watch/.env` for
  Whisper transcription. Without one, captioned videos still work; uncaptioned
  ones return frames only.

The skill is **slash-command-only** by its own frontmatter: it runs on a literal
`/watch-video`, and deliberately does not auto-trigger on "summarize this video"
or a bare YouTube URL.

## Updating

```bash
git clone --depth 1 https://github.com/Newuxtreme/watch-video-skill.git /tmp/wv
cp -a /tmp/wv/SKILL.md /tmp/wv/scripts /tmp/wv/README.md /tmp/wv/LICENSE \
      /tmp/wv/THIRD_PARTY_NOTICES.md .claude/skills/watch-video/
```
