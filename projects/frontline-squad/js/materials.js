// Material library for Frontline Squad.
//
// Every surface texture is painted procedurally into a canvas at load time, so the
// game ships without image files and still gets texel detail instead of flat colour.
// If real textures are dropped into `assets/textures/` and listed in
// `assets/manifest.json`, they replace the procedural ones without any code change.

import * as THREE from 'three';

const SIZE = 256;

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

/** Random speckle pass used by most surfaces to break up flat fills. */
function speckle(g, size, count, colors, rMin = 0.6, rMax = 2.4) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, rMin + Math.random() * (rMax - rMin), 0, Math.PI * 2);
    g.fill();
  }
}

/** Wraps drawing so the result tiles seamlessly: draw, then blend the offset copy. */
function seamless(draw, size = SIZE) {
  const [c, g] = canvas(size);
  draw(g, size);
  const [c2, g2] = canvas(size);
  g2.drawImage(c, 0, 0);
  g2.globalCompositeOperation = 'source-over';
  // offset by half and feather the seam with a soft gradient mask
  const half = size / 2;
  g2.save();
  g2.beginPath();
  g2.rect(0, 0, size, size);
  g2.clip();
  g2.globalAlpha = 0.5;
  g2.drawImage(c, -half, -half);
  g2.drawImage(c, half, -half);
  g2.drawImage(c, -half, half);
  g2.drawImage(c, half, half);
  g2.restore();
  return c2;
}

const PAINTERS = {
  sand(g, s) {
    g.fillStyle = '#d9b678';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {           // wind ripples
      g.strokeStyle = Math.random() > 0.5 ? 'rgba(255,238,200,0.22)' : 'rgba(150,115,60,0.16)';
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const y = Math.random() * s;
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 20, s * 0.7, y + (Math.random() - 0.5) * 20, s, y);
      g.stroke();
    }
    speckle(g, s, 1800, ['rgba(255,245,215,0.35)', 'rgba(140,105,55,0.28)', 'rgba(190,150,90,0.3)']);
    speckle(g, s, 90, ['rgba(120,95,60,0.5)', 'rgba(90,70,45,0.45)'], 1.5, 3.2);   // pebbles
  },

  plaster(g, s) {
    g.fillStyle = '#efe0c6';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {           // trowel patches
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(190,168,132,0.18)';
      g.beginPath();
      g.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 30, 8 + Math.random() * 20,
        Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, s, 900, ['rgba(255,255,255,0.18)', 'rgba(160,140,110,0.16)']);
    for (let i = 0; i < 12; i++) {           // hairline cracks
      g.strokeStyle = 'rgba(120,100,75,0.3)';
      g.lineWidth = 1;
      g.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },

  plasterWarm(g, s) {
    PAINTERS.plaster(g, s);
    g.fillStyle = 'rgba(214,168,110,0.32)';
    g.fillRect(0, 0, s, s);
  },

  terracotta(g, s) {
    g.fillStyle = '#b85f3a';
    g.fillRect(0, 0, s, s);
    const rows = 6, cols = 8;
    const rw = s / cols, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * rw + (r % 2 ? rw / 2 : 0);
        const y = r * rh;
        const shade = 0.85 + Math.random() * 0.3;
        g.fillStyle = `rgba(${Math.round(198 * shade)},${Math.round(102 * shade)},${Math.round(62 * shade)},1)`;
        g.beginPath();
        g.roundRect ? g.roundRect(x + 1, y + 1, rw - 2, rh - 2, 3) : g.rect(x + 1, y + 1, rw - 2, rh - 2);
        g.fill();
        g.strokeStyle = 'rgba(90,40,25,0.55)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    speckle(g, s, 500, ['rgba(255,220,190,0.18)', 'rgba(70,30,18,0.2)']);
  },

  wood(g, s) {
    g.fillStyle = '#8a5a33';
    g.fillRect(0, 0, s, s);
    const planks = 5, ph = s / planks;
    for (let p = 0; p < planks; p++) {
      const shade = 0.82 + Math.random() * 0.35;
      g.fillStyle = `rgba(${Math.round(150 * shade)},${Math.round(98 * shade)},${Math.round(56 * shade)},1)`;
      g.fillRect(0, p * ph, s, ph - 2);
      for (let i = 0; i < 14; i++) {         // grain
        g.strokeStyle = 'rgba(80,50,26,0.28)';
        g.lineWidth = 0.8 + Math.random();
        g.beginPath();
        const y = p * ph + Math.random() * ph;
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.33, y + (Math.random() - 0.5) * 6, s * 0.66, y + (Math.random() - 0.5) * 6, s, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(50,30,15,0.5)';
      g.fillRect(0, p * ph + ph - 2, s, 2);  // plank gap
    }
    speckle(g, s, 260, ['rgba(60,36,18,0.3)', 'rgba(210,170,120,0.16)']);
  },

  metal(g, s) {
    g.fillStyle = '#8f98a3';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) {           // brushed streaks
      g.strokeStyle = Math.random() > 0.5 ? 'rgba(220,230,240,0.2)' : 'rgba(60,70,82,0.22)';
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      const x = Math.random() * s;
      g.moveTo(x, 0);
      g.lineTo(x + (Math.random() - 0.5) * 8, s);
      g.stroke();
    }
    speckle(g, s, 200, ['rgba(120,75,45,0.35)', 'rgba(40,48,58,0.3)'], 1, 3);    // rust and dents
  },

  stone(g, s) {
    g.fillStyle = '#b3a183';
    g.fillRect(0, 0, s, s);
    const rows = 5, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 3 + (r % 2);
      const cw = s / cols;
      for (let c = 0; c < cols; c++) {
        const x = c * cw + (r % 2 ? -cw / 3 : 0);
        const shade = 0.85 + Math.random() * 0.3;
        g.fillStyle = `rgba(${Math.round(186 * shade)},${Math.round(166 * shade)},${Math.round(132 * shade)},1)`;
        g.fillRect(x + 2, r * rh + 2, cw - 4, rh - 4);
        g.strokeStyle = 'rgba(105,92,70,0.5)';
        g.lineWidth = 2;
        g.strokeRect(x + 2, r * rh + 2, cw - 4, rh - 4);
      }
    }
    speckle(g, s, 700, ['rgba(255,250,235,0.16)', 'rgba(95,82,60,0.2)']);
  },

  canvasCloth(g, s) {
    g.fillStyle = '#c8b183';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 4) {         // woven threads
      g.strokeStyle = i % 8 === 0 ? 'rgba(255,245,220,0.16)' : 'rgba(120,100,68,0.16)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
    }
    speckle(g, s, 400, ['rgba(90,72,44,0.22)', 'rgba(255,250,235,0.14)']);
  },
};

/** Per-material surface response; cartoon surfaces stay rough and non-metallic. */
/**
 * Derives a tangent-space normal map from the painted albedo by running a Sobel
 * filter over its luminance. Painted detail (plaster patches, tile edges, plank
 * gaps) then catches light as real relief instead of staying perfectly flat —
 * this is the single biggest reason untextured box geometry reads as a toy.
 */
function normalFromCanvas(source, strength = 2.0) {
  const size = source.width;
  const src = source.getContext('2d').getImageData(0, 0, size, size).data;
  const [out, g] = canvas(size);
  const img = g.createImageData(size, size);

  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  }
  const at = (x, y) => lum[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))
               - (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy = (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))
               - (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      let nx = dx * strength, ny = dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

/** Roughness from the same luminance: darker, dirtier areas scatter more light. */
function roughnessFromCanvas(source, min = 0.62, max = 1.0) {
  const size = source.width;
  const src = source.getContext('2d').getImageData(0, 0, size, size).data;
  const [out, g] = canvas(size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const l = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    const r = Math.round(255 * (max - (max - min) * l));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = r;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}

const SURFACE = {
  sand:        { roughness: 1.0, metalness: 0.0, tile: 4.0, color: 0xffffff, normal: 0.8 },
  plaster:     { roughness: 0.92, metalness: 0.0, tile: 3.0, color: 0xffffff, normal: 1.1 },
  plasterWarm: { roughness: 0.92, metalness: 0.0, tile: 3.0, color: 0xffffff, normal: 1.1 },
  terracotta:  { roughness: 0.8, metalness: 0.0, tile: 2.2, color: 0xffffff, normal: 1.9 },
  wood:        { roughness: 0.88, metalness: 0.0, tile: 1.6, color: 0xffffff, normal: 1.5 },
  metal:       { roughness: 0.45, metalness: 0.65, tile: 1.6, color: 0xffffff, normal: 1.0 },
  canvasCloth: { roughness: 0.95, metalness: 0.0, tile: 1.6, color: 0xffffff, normal: 1.2 },
  stone:       { roughness: 0.95, metalness: 0.0, tile: 2.4, color: 0xffffff, normal: 2.2 },
};

export class MaterialLibrary {
  constructor(renderer) {
    this.renderer = renderer;
    this.textures = new Map();
    this.maps = new Map();
    this.materials = new Map();
    this.colored = new Map();
    this.external = null;
  }

  /**
   * Optional: `assets/manifest.json` may map material names to image files, e.g.
   * { "textures": { "sand": "textures/sand.png" } }. Anything not listed stays procedural.
   */
  async loadManifest(base = 'assets/') {
    try {
      const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return false;
      const manifest = await res.json();
      const loader = new THREE.TextureLoader();
      const entries = Object.entries(manifest.textures || {});
      await Promise.all(entries.map(([name, file]) => new Promise((resolve) => {
        loader.load(`${base}${file}`, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          this.textures.set(name, tex);
          const mat = this.materials.get(name);
          if (mat) { mat.map = tex; mat.needsUpdate = true; }
          resolve();
        }, undefined, () => resolve());
      })));
      this.external = manifest;
      return true;
    } catch {
      return false;
    }
  }

  texture(name) {
    if (this.textures.has(name)) return this.textures.get(name);
    this.buildMaps(name);
    return this.textures.get(name) || null;
  }

  /** Albedo, normal and roughness for one surface, all painted from the same source. */
  buildMaps(name) {
    const painter = PAINTERS[name];
    if (!painter) return null;
    const source = seamless(painter);
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const wrap = (canvasEl, srgb) => {
      const tex = new THREE.CanvasTexture(canvasEl);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = aniso;
      return tex;
    };

    const albedo = wrap(source, true);
    this.textures.set(name, albedo);
    this.maps.set(name, {
      normal: wrap(normalFromCanvas(source), false),
      roughness: wrap(roughnessFromCanvas(source), false),
    });
    return albedo;
  }

  /** Shared material per surface name — UVs are scaled per mesh instead of the map. */
  get(name) {
    if (this.materials.has(name)) return this.materials.get(name);
    const surf = SURFACE[name] || SURFACE.plaster;
    const map = this.texture(name);
    const extra = this.maps.get(name);
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap: extra ? extra.normal : null,
      normalScale: new THREE.Vector2(surf.normal ?? 1, surf.normal ?? 1),
      roughnessMap: extra ? extra.roughness : null,
      color: surf.color,
      roughness: surf.roughness,
      metalness: surf.metalness,
      envMapIntensity: 0.35,
      vertexColors: true,        // baked ambient occlusion rides in vertex colours
    });
    this.materials.set(name, mat);
    return mat;
  }

  tileOf(name) {
    return (SURFACE[name] || SURFACE.plaster).tile;
  }

  /** Flat coloured material (banners, capture rings, team accents). */
  color(hex, opts = {}) {
    const key = `${hex}|${opts.emissive || 0}|${opts.roughness ?? 0.7}`;
    if (this.colored.has(key)) return this.colored.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0.0,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      envMapIntensity: 0.3,
      flatShading: !!opts.flatShading,
    });
    this.colored.set(key, mat);
    return mat;
  }
}

/**
 * Projects UVs planar per face, using each vertex's dominant normal axis. Unlike the
 * BoxGeometry-specific version below this works on bevelled and rounded geometry too,
 * and keeps texel density constant no matter how large the piece is.
 */
export function projectPlanarUVs(geometry, tile = 1) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }        // floors and roofs
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }               // walls facing X
    else { u = pos.getX(i); v = pos.getY(i); }                             // walls facing Z
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Bakes a cheap ambient occlusion term into vertex colours: darker towards the base of
 * every piece and on downward faces. It costs nothing at runtime — important on phones,
 * where a screen-space AO pass is not affordable — and stops objects from looking like
 * they are pasted onto the ground.
 */
export function bakeVertexAO(geometry, { height = 1.3, strength = 0.4, downward = 0.22 } = {}) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = Math.min(1, (pos.getY(i) - minY) / height);
    let ao = 1 - strength * (1 - h) * (1 - h);
    if (nrm.getY(i) < -0.45) ao *= 1 - downward;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = ao;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Flat white vertex colours for geometry that needs the attribute but no shading. */
export function neutralVertexColors(geometry) {
  const count = geometry.attributes.position.count;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  return geometry;
}

/**
 * Rewrites a BoxGeometry's UVs so every face keeps the same texel density,
 * independent of the box dimensions. Without this a 30 m wall and a 2 m crate
 * would show the same texture stretched to wildly different scales.
 */
export function applyBoxUVs(geometry, w, h, d, tile = 1) {
  const uv = geometry.attributes.uv;
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z — 4 vertices each
  const spans = [
    [d, h], [d, h],   // sides facing X use depth x height
    [w, d], [w, d],   // top and bottom use width x depth
    [w, h], [w, h],   // faces facing Z use width x height
  ];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = spans[face];
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su / tile, uv.getY(idx) * sv / tile);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
