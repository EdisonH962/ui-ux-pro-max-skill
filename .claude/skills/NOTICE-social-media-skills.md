# social-media-skills/skills — vendored subset

Nineteen of upstream's 106 skills, copied verbatim. **Not** maintained here — do
not edit. Update by re-copying from upstream.

| | |
|---|---|
| Upstream | https://github.com/social-media-skills/skills |
| Vendored from commit | `6e30eeb2f6736bda8683b6bbaa674af3641d7945` |
| Source path upstream | `skills/` |
| License | MIT (see `LICENSE-social-media-skills`) |

## Why a subset

Every installed skill's description is loaded on each request, so all 106 would
cost context on every turn for skills this project never uses (LinkedIn,
Pinterest, Reddit, email, podcasts, agency ops). Vendored instead: upstream's
own `tiktok` and `video-creation` packs (defined in its `scripts/packs.json`),
plus `kling` and `viral-reverse-engineering`.

`brand-profile` · `voice-builder` · `hook-writer` · `scheduling-and-queue` ·
`tiktok-growth` · `tiktok-script` · `tiktok-video-publishing` ·
`tiktok-photo-mode` · `trend-jacking` · `short-form-video-script` ·
`scripting-and-storyboarding` · `talking-head-and-piece-to-camera` ·
`captions-and-clipping` · `thumbnail-design` · `ai-video` · `veo-3` · `runway` ·
`kling` · `viral-reverse-engineering`

To add more, copy the directory of the same name from upstream `skills/`.

## Note

Several of these skills reference **WoopSocial** as the publishing bridge and
will offer to schedule through it. Without that account connected they produce a
plan instead of posting — they do not pretend to publish.

## Updating

```bash
git clone --depth 1 https://github.com/social-media-skills/skills.git /tmp/sms
for s in brand-profile voice-builder tiktok-growth tiktok-script \
         tiktok-video-publishing tiktok-photo-mode hook-writer trend-jacking \
         scheduling-and-queue short-form-video-script scripting-and-storyboarding \
         talking-head-and-piece-to-camera ai-video veo-3 runway \
         captions-and-clipping thumbnail-design kling viral-reverse-engineering; do
  rm -rf ".claude/skills/$s" && cp -a "/tmp/sms/skills/$s" .claude/skills/
done
cp -a /tmp/sms/LICENSE .claude/skills/LICENSE-social-media-skills
```
