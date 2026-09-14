# Assets

The game ships without image files: every texture is painted procedurally at load time
(`js/materials.js`). This directory is the drop-in point for replacing them.

## Adding a real texture

1. Put a seamless, square image into `textures/` (PNG or JPG, 512×512 or 1024×1024).
2. Reference it in `manifest.json`:

```json
{ "textures": { "sand": "textures/sand.png", "plaster": "textures/plaster.png" } }
```

3. Reload. Anything not listed stays procedural, so you can replace surfaces one at a time.

Material names: `sand`, `stone`, `plaster`, `plasterWarm`, `terracotta`, `wood`, `metal`,
`canvasCloth`.

Textures must tile seamlessly — they are repeated across large surfaces with per-mesh UV
scaling, so a non-tiling image will show visible seams on every wall.

## Generated textures waiting to be downloaded

These were generated for this project but could not be fetched into the repository from the
build environment (its egress policy blocks the CDN). Open each link, save it under the given
filename in `textures/`, then add the line shown to `manifest.json`.

| Save as | Manifest entry | Link |
| --- | --- | --- |
| `textures/sand.png` | `"sand": "textures/sand.png"` | https://d8j0ntlcm91z4.cloudfront.net/user_3G8m1bxNBqhjlyBCY2gFUlzpzbo/hf_20260914_222621_95079b03-266f-4259-a9fd-8b7212cf01d4.png |
| `textures/terracotta.png` | `"terracotta": "textures/terracotta.png"` | https://d8j0ntlcm91z4.cloudfront.net/user_3G8m1bxNBqhjlyBCY2gFUlzpzbo/hf_20260914_224333_d2a4c00e-9f64-49bb-ad3c-f1621b78c007.png |
| `textures/wood.png` | `"wood": "textures/wood.png"` | https://d8j0ntlcm91z4.cloudfront.net/user_3G8m1bxNBqhjlyBCY2gFUlzpzbo/hf_20260914_224333_a97e8c45-03cd-4850-a924-82ef3a3cc774.png |
| `textures/stone.png` | `"stone": "textures/stone.png"` | https://d8j0ntlcm91z4.cloudfront.net/user_3G8m1bxNBqhjlyBCY2gFUlzpzbo/hf_20260914_224334_47c4541a-b1ff-4d10-882a-62f33116ea09.png |

Generated images are not guaranteed to tile. Check each one before committing it: if a seam
shows up on the walls, either fix it in an image editor (offset by half, retouch the seam) or
leave that surface procedural.
