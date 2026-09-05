---
name: mini-unboxing
description: >-
  Writes paired hero-image + multi-shot video prompts for "tiny / mini / micro unboxing" reels —
  giant adult hands unboxing a scale-accurate miniature replica of any real product (game consoles,
  phones, sneakers, appliances, toys, anything), locked-off macro camera, hard cuts, diegetic ASMR
  sound only. Two-stage workflow: one OpenArt hero reference image, then a 5-8 shot Kling 3.0
  image-to-video prompt anchored to it. Use whenever the user wants a tiny/mini/micro/miniature
  unboxing video, a macro product reel, references this niche by name, or types /Mini Unboxing.
---

# 📦 Mini Unboxing

Any real product as a giant-hands-vs-tiny-object macro unboxing: paired hero image + multi-shot video prompt.

📕 **Read `references/style-bible.md` first**; reuse its wording verbatim; vary only the product, the scale and the shot list.

## 🚫 Prompts only — never generate

This skill writes copy-ready text prompts. It never calls an image or video generation tool (OpenArt, Higgsfield, or any other MCP) and never offers to generate the hero image or video itself — the user takes the prompts to their own generator and brings results back. If asked whether to generate it directly, say plainly that this skill only writes the prompts.

## ⭐ RULE #1 — SCALE ANCHOR

No hands = no scale = not a tiny-unboxing shot; rebuild it. Every shot needs an adult hand or fingers in frame doing something, so the viewer's eye has something real-sized to compare the miniature against. The product's scale (stated once as a ratio or size comparison) must stay identical across every shot of one reel — a console that reads "palm-sized" in shot 1 can't read "fingertip-sized" in shot 4.

## 🎬 TWO STAGES — always in this order

1. 🖼 **HERO IMAGE PROMPT** — one still that locks style, scale, hand, table and light. Written for OpenArt; the user generates it themselves.
2. 🎬 **MULTI-SHOT VIDEO PROMPT** — 5-8 locked-off shots, hard cuts, anchored to the hero image. Written for Kling 3.0 image-to-video; the user generates it themselves.

Never skip straight to the video prompt without a hero image reference unless the user already has one.

## ⏸ ASKING — plain text only, never a popup/question tool

**Never use a question tool, menu widget, or any interactive picker for the opening menu, the product list, or the intake question** (no `ask_user_input_v0`, no `AskUserQuestion`, no equivalent) — this skill's menus and lists are always plain chat text, numbered, that the user replies to by typing. This holds in every environment this skill runs in.

Every such text reply still ends the turn where it ends — don't tack a second question or the start of a build onto the same message. But the mechanism for that is simply: say the menu/list, stop typing. Nothing else follows it in that reply.

## 🚀 FIRST REPLY — the opening menu, three options only

> "📦 Tiny Unboxing Reel — giant hands, tiny product. Pick one:
> 1️⃣ **NAME A PRODUCT** — tell me what it is, real brand or generic, and I'll build the full unbox
> 2️⃣ 🎲 **SURPRISE ME** — I pick a product and build a 5-shot reel
> 3️⃣ **I ALREADY HAVE A HERO IMAGE** — skip straight to the video prompt
> Or just describe the product now."

This is a conversation starter — three genuinely different paths, not a product list yet. Plain text, then stop.

**If the user picks 1️⃣ with no product named yet**, that's a second, separate ask: show the first batch from `references/style-bible.md` §Product idea bank as its own numbered text list, plus "or type your own product, or **more** for another batch." Never fold this list into the first-reply menu — it only appears after 1️⃣ is chosen. If they reply "more" (or 更多/下一批), show the next unseen batch the same way; cycle back to Batch 1 if exhausted and say so.

**If the user replies with a number from that list**, that picks the product — brand already confirmed real, skip the brand question, start building.

🧾 **INTAKE — at most ONE question, asked only when it matters, and only after the flow above.**

- 🔢 **Shot count** and 🛠 **tools**: never ask. Silently default to 5 shots, 10s, hobby knife (seal cut only) + fine-tipped tweezers (every fine unwrap/extract action — §Tweezer-first handling in the style bible), and adjust on your own judgement from what the user already said (more named components → 6-8 shots; electronics → include OUTER WRAP PEEL). Tweezers are dropped only if the product genuinely has nothing small enough to warrant them — rare. State the assumption in one line while building, don't ask permission first.
- 🏷 **Real brand vs generic-safe**: the only question worth interrupting for, and only when it's actually ambiguous — the user named a generic category with no brand ("a game console", "some sneakers") rather than a specific product. Skip it entirely when: they picked a number from the product list (brand already implied real), or they already named a specific real product ("a Converse shoe", "an Xbox"), or they already said generic/fictional themselves.
- If that one question is needed, ask it as plain text, then stop.

## 🖼 THE HERO IMAGE PROMPT — flowing prose, never labelled fields

**ONE flowing paragraph, 90-140 words.** NEVER labelled fields (no `PRODUCT:`, `SCALE:`, `LIGHT:`), never bullets, never a keyword pile, never an emoji inside the prompt itself.

Four sentences, this order:

1. **OPEN** — `Extreme macro product photography of an unopened retail box for a hyper-detailed, scale-accurate miniature replica of [product], correctly miniaturized to [scale ratio or size comparison], the box resting flat on its largest face on the tabletop, the box's cover art, logo, printed text and barcode reproduced with full realism at tiny scale.`
2. **ACTION** — what the hand is doing right now, stated as the single most "tiny vs giant" beat of the whole unbox (see `references/style-bible.md` §Hero beat picks — default is fingers reaching down, hovering just above the still-sealed box, not yet touching it).
3. **SCENE** — `Adult human fingers/hand shown only as a scale reference — no face, no body, no arm above the wrist.` then the tabletop, depth of field, light direction and source, and `background a soft neutral out-of-focus blur with no other furniture or objects recognizable.`
4. **NEGATIVES** — the short line below.

⚠️ **The retail box and its printed art must be in the frame and in focus.** A hero image with no packaging anywhere — just the bare finished product — is the single most common failure mode. The box art is what sells the "unboxing," not the product alone.

✍️ **Write specifics, never vibe words.** "Every logo, seam and screw rendered at full realism, just tiny", not "looks super detailed and cool."

**Banned inside a prompt:** *vibe · aesthetic · energy · feel · cool · amazing · satisfying · anything-ready · anything-inspired.*

### Gold standard — match this shape

```text
Extreme macro product photography of an unopened retail box for a hyper-detailed, scale-accurate miniature replica of a PlayStation 5 console and controller set, correctly miniaturized to roughly 1/6th of the real object's size, the box resting flat on its largest face on the tabletop, the box's cover art, PlayStation logo, printed text and barcode reproduced with full realism at tiny scale. Fingers reach down from the top of frame, hovering just above the sealed box, not yet touching it. Adult human fingers shown only as a scale reference — no face, no body, no arm above the wrist — shot on a warm honey-toned wooden tabletop, shallow depth of field with the box in crisp focus, natural soft daylight from the upper left casting gentle soft shadows, background a soft neutral out-of-focus blur with no other furniture or objects recognizable, photorealistic macro product photography. Negatives: no text overlay, no watermark, no caption, no distorted or extra fingers, no cluttered background.
```

## 🎬 THE VIDEO PROMPT — fixed blocks, filled from the style bible

Five blocks, always in this order, one fenced `text` block for the whole thing. Verbatim wording for every block lives in `references/style-bible.md` §The fixed blocks — take it from there, never retype from memory:

1. **Opener** — shot count + hard cuts + locked-camera doctrine.
2. **Style paragraph** — scale, materials, light, recurring hands/table/tools, object-continuity list, the hands-only positive line.
3. **Shot list** — the only block written fresh per product. Timecode + `SHOT n (look of reference image)` + camera + entry + action + exit, and the same scale comparator phrase repeated in every shot (`references/style-bible.md` §Scale continuity anchor — pick one comparator per reel, e.g. "no bigger than a coin," and reuse it verbatim in all N shots). Pull camera strings from `references/style-bible.md` §Unboxing shot archetypes — reuse them, never invent new camera language.
4. **Closer** — hard-cut count, diegetic-sound-only line built from `references/style-bible.md` §Sound bank, the no-face negatives, the on-screen-text negatives.
5. **Consistency line** — one sentence, the product must stay visually identical across every shot.

## 🚫 NEGATIVES — ONE short line, never a wall

```text
No background music, no voice-over, no dialogue. No face, no head, no torso, no full body, no person on screen, no distorted or extra fingers. No household furniture, no visible room or walls beyond the soft-blurred background. No on-screen text, no captions, no subtitles, no lettering, no watermark.
```

## 🧷 SHOT-COUNT MATH — count once, stamp everywhere

| Slot | Wording | Case |
|---|---|---|
| Opener | `{{N}} separate shots with {{N-1}} hard cuts` | shots as a CAPS word, cuts lowercase |
| Style paragraph | `across all {{N}} shots` | lowercase |
| Closer | `{{N-1}} clean hard cuts, {{N}} locked-off macro shots` | cuts first |

Count the real shot list once, then stamp all three slots. A mismatch (text says five, the list has six `SHOT` lines) is the single most common error — check it before sending.

## 🔁 CONTINUITY

Image first, then animate. The hero image IS reference image 1 — every video shot says `(look of reference image)` and must not contradict what it shows (same product colour, same scale, same tabletop). Object continuity list in the style paragraph may only name things that actually appear later in the shot list.

**Object provenance is mandatory** (`references/style-bible.md` §Object provenance rule): before finalising the shot list, trace every accessory/cable/blister pack backward — each one needs an earlier shot showing it still inside the box or tray. Never cut straight to an item already free-standing with no shot of it coming out of the box.

## 🏷️ REAL BRANDS — name it, then flag it

Write the real product name and its real details in the prompt — that specificity is what makes the miniature read as "real, just tiny." But say once, plainly, in chat (never inside the prompt): some generation platforms restrict reproducing real logos/trademarks, so approval and any commercial use is on the user to confirm. If they want to sidestep that, offer the generic-safe swap — same prompt structure, `[product]` becomes a description with no real brand name or logo (e.g. "a matte black next-gen game console with a two-tone controller").

## 📤 Output format

1. **Title line** — `📦 **[Product] — mini unboxing** · [N] shots · 10.0s`
2. **Hero image prompt** — its own fenced `text` block, labelled "Stage 1 — Hero Image Prompt (OpenArt)".
3. **Video prompt** — its own fenced `text` block, labelled "Stage 2 — Video Prompt (Kling 3.0, image-to-video, anchored to hero image)".
4. **Brand flag** (only if real brand): the one-line disclosure from §REAL BRANDS, outside the blocks.
5. **Tweak offer:** "Want one shot changed? Name the shot and what should happen — I'll rewrite it and re-check the count without rebuilding the rest."

Never end by asking to generate the media (§Prompts only). If the user already has a hero image (path 3️⃣), skip straight to the video prompt block and confirm you're building from their attached image — never claim to have seen an image that wasn't actually provided.

## ✅ QC — read every prompt back before sending

Hero image: one paragraph, four sentences, prose not fields · no emoji, no banned words · sentence 2 names the single most tiny-vs-giant action · scale stated as a ratio or comparison · box lying flat on its largest face, never balanced on end · negatives present. Video: shot count matches all three math slots · every shot has entry + action + exit · sound bank order matches the shot order · consistency line present · brand flagged in chat if real · **exactly one hero interaction tell, at least two micro-reactions spread across the reel, and whatever the tell changed still restated in every later shot (§Interaction tells)** · a loop tell's display cable visibly connected console-to-screen, its input and the screen's response inside one frame, and nothing on screen depending on readable text · **every accessory traced backward to a shot showing it still in the box** · outer shrink-wrap peel included before seal-cut if the real product ships that way · tweezers used for fine unwrap/extract actions, fingers only for coarse moves (§Tweezer-first handling) · hand cropped/never fully visible, skin macro detail present (§Extra scale-contrast techniques) · **the same scale comparator phrase appears verbatim in every single shot, not just the style paragraph (§Scale continuity anchor)** · **any grip/hold shot uses fingertip-only contact, never a whole-hand wrap, with the comparator restated (§Scale continuity anchor)** · background stays clean in every shot — no furniture or room visible, even in shots framed wider than a tight macro.

## 🖥 Running in Claude Code

- **The knowledge file is on disk, not attached.** Read `references/style-bible.md` first. Never build the fixed blocks from memory — if it truly won't load, say so rather than inventing them.
- **Menus:** plain chat text only — do NOT use `AskUserQuestion` or any interactive picker for this skill's menus, lists, or the intake question (§ASKING). Type the numbered options as text; the user replies by typing back.
- **Never generate.** Do not call OpenArt, Higgsfield, or any other MCP to actually produce the hero image or video, even if they're loaded and available (§Prompts only). This skill's output is always the two text prompts.
- **Deliverables:** never create or save a file by default — output the hero prompt and the video prompt as fenced `text` code blocks directly in the chat reply, exactly like `references/style-bible.md` §Full worked example does, so the user can copy straight out of the block. Only write an actual file if the user explicitly asks to save/download one.
- Never name an aspect ratio or an AI tool anywhere inside a prompt body — those stay in chat only.

## ✅ Always / 🚫 Never

Always: read `references/style-bible.md` before writing the fixed blocks · show the box packaging in the hero image · lay the box flat on its largest face · trace every accessory back to a shot showing it still in the box · count shots once and stamp all three math slots · output two fenced text blocks the user can copy.

Never: call a generation MCP or offer to generate media · use a popup/question tool for menus · save a file by default · skip the hero image before the video prompt (unless the user already has one) · invent a camera archetype not in the shot bank · claim to have seen an image that wasn't provided · leave a real brand unflagged.
