// Procedural arena "Sandsturm-Basar": geometry, colliders, spawns, capture points
// and a waypoint graph the bots navigate on. No external assets — everything is
// generated from code at load time.

import * as THREE from 'three';
import { TEAMS } from './config.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { projectPlanarUVs, bakeVertexAO, neutralVertexColors } from './materials.js';

const GROUND_NORMAL = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const AXES = ['x', 'y', 'z'];
const AXIS_NORMALS = {
  x: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)],
  y: [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)],
  z: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)],
};

/** Slab-method ray/box test returning entry distance and the face normal hit. */
function rayAABB(origin, dir, min, max, maxT) {
  let tmin = 0, tmax = maxT;
  let axis = null, side = 0;
  for (const a of AXES) {
    const d = dir[a];
    if (Math.abs(d) < 1e-9) {
      if (origin[a] < min[a] || origin[a] > max[a]) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min[a] - origin[a]) * inv;
    let t2 = (max[a] - origin[a]) * inv;
    let near = 0;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; near = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; side = near; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (!axis || tmin <= 0 || tmin >= maxT) return null;
  return { t: tmin, normal: AXIS_NORMALS[axis][side] };
}

const PALETTE = {
  sand: 'sand',
  sandDark: 'stone',
  plaster: 'plaster',
  plasterWarm: 'plasterWarm',
  terracotta: 'terracotta',
  wood: 'wood',
  metal: 'metal',
  cloth: 'canvasCloth',
};

function skyDome() {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x1f5fb0) },
      mid: { value: new THREE.Color(0x9ccbe8) },
      bottom: { value: new THREE.Color(0xf6dfb4) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bottom, pow(-h, 0.5));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.mats = materials;
    this.colliders = [];          // Box3 list for movement and ray casts
    this.mergeable = [];          // static meshes that get batched per material
    this.spawns = { alpha: [], bravo: [] };
    this.points = [];             // domination capture points
    this.waypoints = [];
    this.graph = [];
    this.bounds = { min: -58, max: 58 };
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  build() {
    this.scene.fog = new THREE.Fog(0xe4c9a0, 70, 230);
    this.scene.add(skyDome());

    // key light is a low, warm desert sun; the sky fills the shadows with cool bounce
    const hemi = new THREE.HemisphereLight(0xa8c8f0, 0xd8b27a, 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe7bd, 2.1);
    sun.position.set(48, 62, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 80;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // ground
    const groundGeo = new THREE.PlaneGeometry(260, 260);
    const groundUv = groundGeo.attributes.uv;
    for (let i = 0; i < groundUv.count; i++) {
      groundUv.setXY(i, groundUv.getX(i) * 65, groundUv.getY(i) * 65);
    }
    neutralVertexColors(groundGeo);
    const ground = new THREE.Mesh(groundGeo, this.mats.get('sand'));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.groundMesh = ground;

    this.buildPerimeter();
    this.buildBases();
    this.buildCentre();
    this.buildFlanks();
    this.buildProps();
    this.decorate();
    this.buildCapturePoints();
    // Raycasts read matrixWorld, which three.js only refreshes during a render.
    // The nav mesh is built before the first frame, so push the matrices now —
    // otherwise every collider would be treated as sitting at the origin.
    this.group.updateMatrixWorld(true);
    this.buildWaypoints();
    this.batchStatics();
    return this;
  }

  // ---------------------------------------------------------------- builders

  box(x, y, z, w, h, d, surface, opts = {}) {
    let mat;
    let tile = 1;
    if (typeof surface === 'string') {
      mat = this.mats.get(surface);
      tile = this.mats.tileOf(surface);
    } else {
      mat = this.mats.color(surface, opts);
    }
    if (opts.opacity != null) {
      mat = mat.clone();
      mat.transparent = true;
      mat.opacity = opts.opacity;
    }
    // Bevelled edges instead of hard 90° corners: the chamfer catches a highlight,
    // which is most of the difference between "building" and "toy brick".
    const bevel = Math.min(0.06, w / 2.5, h / 2.5, d / 2.5);
    const geo = opts.sharp
      ? new THREE.BoxGeometry(w, h, d)
      : new RoundedBoxGeometry(w, h, d, 1, bevel);
    if (typeof surface === 'string') {
      projectPlanarUVs(geo, tile);
      bakeVertexAO(geo, { height: Math.min(1.6, h) });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (opts.static !== false && opts.opacity == null) {
      this.mergeable.push(mesh);          // flat-coloured trim batches just as well
    }
    if (opts.solid !== false) {
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h, z + d / 2)
      ));
    }
    return mesh;
  }

  // adds the same piece on both halves of the map (point symmetry through origin)
  sym(fn) {
    fn(1);
    fn(-1);
  }

  cylinder(x, y, z, r, h, surface, opts = {}) {
    const mat = typeof surface === 'string' ? this.mats.get(surface) : this.mats.color(surface, opts);
    const cylGeo = new THREE.CylinderGeometry(r, r, h, opts.segments || 16);
    if (typeof surface === 'string') {
      projectPlanarUVs(cylGeo, this.mats.tileOf(surface));
      bakeVertexAO(cylGeo, { height: Math.min(1.6, h) });
    }
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (typeof surface === 'string') this.mergeable.push(mesh);
    if (opts.solid !== false) {
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - r, y, z - r),
        new THREE.Vector3(x + r, y + h, z + r)
      ));
    }
    return mesh;
  }

  stairs(x, y, z, width, steps, stepH, stepD, color, axis = 'z', dir = 1) {
    for (let i = 0; i < steps; i++) {
      const h = stepH * (i + 1);
      if (axis === 'z') this.box(x, y, z + dir * (i * stepD + stepD / 2), width, h, stepD, color);
      else this.box(x + dir * (i * stepD + stepD / 2), y, z, stepD, h, width, color);
    }
  }

  buildPerimeter() {
    const L = 116, H = 9, T = 2;
    const half = L / 2;
    this.box(0, 0, -half, L, H, T, PALETTE.sandDark);
    this.box(0, 0, half, L, H, T, PALETTE.sandDark);
    this.box(-half, 0, 0, T, H, L, PALETTE.sandDark);
    this.box(half, 0, 0, T, H, L, PALETTE.sandDark);
    // corner towers for silhouette
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box(sx * half, 0, sz * half, 7, 13, 7, PALETTE.plasterWarm);
    }
  }

  buildBases() {
    // Alpha spawns at -Z, Bravo at +Z. Mirrored geometry keeps the map fair.
    this.sym((s) => {
      const team = s === 1 ? 'alpha' : 'bravo';
      const z = s * 44;              // hangar centre
      const front = z - s * 7;       // open side, facing the middle of the map
      const color = TEAMS[team].color;

      // hangar shell: back wall, side walls, roof on two pillars (front stays open)
      this.box(0, 0, z + s * 7, 30, 7, 1.2, PALETTE.plaster);
      this.box(-15, 0, z, 1.2, 7, 15, PALETTE.plaster);
      this.box(15, 0, z, 1.2, 7, 15, PALETTE.plaster);
      this.box(0, 7, z, 32, 0.8, 17, PALETTE.terracotta);
      this.box(-11.5, 0, front, 5, 6.4, 1.2, PALETTE.plasterWarm);
      this.box(11.5, 0, front, 5, 6.4, 1.2, PALETTE.plasterWarm);
      this.box(0, 6.4, front, 30, 0.6, 1.2, PALETTE.plasterWarm);

      // team banner above the gate
      const banner = this.box(0, 7.9, front, 10, 3, 0.4, color, { solid: false });
      banner.material.emissive = new THREE.Color(color).multiplyScalar(0.25);

      // low spawn podium — half a step high so nobody gets stuck on it
      this.box(0, 0, z + s * 3, 22, 0.5, 6, PALETTE.sandDark);

      // sandbag cover in front of the base
      for (const x of [-16, -6, 6, 16]) this.box(x, 0, z - s * 14, 5, 1.5, 1.6, PALETTE.wood);

      // sniper balcony on the flank with a staircase up its back
      this.box(s * 26, 0, z - s * 12, 9, 6, 9, PALETTE.plasterWarm);
      this.box(s * 26, 6, z - s * 12, 9, 0.6, 9, PALETTE.terracotta);
      this.stairs(s * 26, 0, z - s * 3, 6, 10, 0.66, 0.9, PALETTE.sandDark, 'z', -s);

      for (let i = 0; i < 6; i++) {
        this.spawns[team].push(new THREE.Vector3(-9 + i * 3.6, 0.55, z + s * 3));
      }
    });
  }

  buildCentre() {
    // central market tower: a solid base with an open, canopied rooftop (point B)
    this.box(0, 0, 0, 16, 5, 16, PALETTE.plaster);
    this.box(0, 5, 0, 18, 0.7, 18, PALETTE.terracotta);          // walkable rooftop
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box(sx * 6.6, 5.7, sz * 6.6, 1.2, 3.2, 1.2, PALETTE.wood);   // canopy pillars
    }
    this.box(0, 8.9, 0, 15, 0.6, 15, PALETTE.terracotta);        // canopy roof

    this.sym((s) => {
      // ramps climb along +/-X, so the railings only guard the Z sides
      this.stairs(s * 17, 0, 0, 7, 9, 0.65, 1.1, PALETTE.sandDark, 'x', -s);
      this.box(0, 5.7, s * 8.3, 18, 1.0, 0.8, PALETTE.wood);
    });

    // market stalls ringing the tower
    this.sym((s) => {
      this.box(s * 14, 0, s * 13, 6, 2.6, 6, PALETTE.plasterWarm);
      this.box(s * 14, 2.6, s * 13, 6, 0.4, 6, PALETTE.terracotta);
      this.box(-s * 15, 0, s * 14, 5, 3.4, 5, PALETTE.plaster);
      this.box(-s * 15, 3.4, s * 14, 5, 0.4, 5, PALETTE.terracotta);
    });
  }

  buildFlanks() {
    // two walled courtyards (domination points A and C), open towards the centre
    this.sym((s) => {
      const x = s * 34;
      this.box(x, 0, -10, 18, 4.5, 1.5, PALETTE.plaster);          // side wall
      this.box(x, 0, 10, 18, 4.5, 1.5, PALETTE.plaster);
      this.box(x + s * 8.5, 0, 0, 1.5, 4.5, 21, PALETTE.plaster);  // outer wall
      this.box(x - s * 8.5, 0, -7, 1.5, 4.5, 7, PALETTE.plasterWarm);  // gate pillars
      this.box(x - s * 8.5, 0, 7, 1.5, 4.5, 7, PALETTE.plasterWarm);

      // roof walkway over the walls
      this.box(x, 4.5, -10, 20, 0.7, 4.5, PALETTE.terracotta);
      this.box(x, 4.5, 10, 20, 0.7, 4.5, PALETTE.terracotta);
      this.box(x + s * 8.5, 4.5, 0, 4.5, 0.7, 21, PALETTE.terracotta);

      // stairs from the open ground up onto that walkway
      this.stairs(x - s * 4, 0, -17.5, 5, 9, 0.62, 1.0, PALETTE.sandDark, 'z', 1);
      this.stairs(x - s * 4, 0, 17.5, 5, 9, 0.62, 1.0, PALETTE.sandDark, 'z', -1);

      // crates inside the yard for cover
      this.box(x + s * 4, 0, -4, 2.2, 1.8, 2.2, PALETTE.wood);
      this.box(x + s * 4, 0, 4, 2.2, 1.8, 2.2, PALETTE.wood);

      // covered walkways connecting base -> flank
      for (const z of [-24, 24]) this.box(x - s * 12, 0, z, 3, 3.2, 6, PALETTE.plasterWarm);
      // long wall with a gap in the middle
      this.box(s * 17, 0, -22, 2, 4, 14, PALETTE.sandDark);
      this.box(s * 17, 0, 22, 2, 4, 14, PALETTE.sandDark);
    });
  }

  buildProps() {
    const crateSpots = [
      [-22, -30], [-18, -28], [-22, -26.5], [22, 30], [18, 28], [22, 26.5],
      [-30, 8], [-30, -8], [30, 8], [30, -8], [-6, 22], [6, -22],
      [12, -34], [-12, 34], [26, -18], [-26, 18], [0, 28], [0, -28],
    ];
    crateSpots.forEach(([x, z], i) => {
      const h = 1.6 + (i % 3) * 0.7;
      this.box(x, 0, z, 2.2, h, 2.2, i % 2 ? PALETTE.wood : PALETTE.plasterWarm);
      if (i % 4 === 0) this.box(x + 0.4, h, z - 0.3, 1.8, 1.4, 1.8, PALETTE.wood);
    });

    const barrels = [[-14, -18], [14, 18], [-8, 12], [8, -12], [36, -28], [-36, 28], [20, 4], [-20, -4]];
    barrels.forEach(([x, z]) => this.cylinder(x, 0, z, 0.8, 2.1, PALETTE.metal));

    // palms: trunk + canopy (canopy is decorative only)
    const palms = [[-40, -20], [40, 20], [-44, 30], [44, -30], [-12, 40], [12, -40], [30, 36], [-30, -36]];
    palms.forEach(([x, z]) => {
      this.cylinder(x, 0, z, 0.45, 7, PALETTE.wood, { segments: 8 });
      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3, 0),
        this.mats.color(0x4f9e4a, { flatShading: true, roughness: 0.9 })
      );
      canopy.position.set(x, 7.6, z);
      canopy.scale.y = 0.55;
      canopy.castShadow = true;
      this.group.add(canopy);
      this.mergeable.push(canopy);
    });
  }

  /**
   * Purely visual detail pass. Everything here is non-solid: it must not change
   * collision or the nav mesh, only the silhouette and surface break-up.
   */
  decorate() {
    const deco = (x, y, z, w, h, d, surface) => this.box(x, y, z, w, h, d, surface, { solid: false });

    // crenellations along the perimeter wall
    const half = 58;
    for (let i = -54; i <= 54; i += 6) {
      deco(i, 9, -half, 2.6, 1.2, 2.6, PALETTE.sandDark);
      deco(i, 9, half, 2.6, 1.2, 2.6, PALETTE.sandDark);
      deco(-half, 9, i, 2.6, 1.2, 2.6, PALETTE.sandDark);
      deco(half, 9, i, 2.6, 1.2, 2.6, PALETTE.sandDark);
    }

    this.sym((s) => {
      const z = s * 44;
      const front = z - s * 7;
      // hangar: cornice band, roof beams, window slots
      deco(0, 6.6, z, 33, 0.5, 18, PALETTE.wood);
      for (const bx of [-12, -6, 0, 6, 12]) deco(bx, 7.8, front + s * 0.6, 1, 0.5, 2.6, PALETTE.wood);
      for (const wz of [-4, 0, 4]) {
        deco(-15.7, 3.6, z + wz, 0.5, 1.6, 2.2, 0x2a2118);
        deco(15.7, 3.6, z + wz, 0.5, 1.6, 2.2, 0x2a2118);
      }
      // balcony railing
      deco(s * 26, 6.6, z - s * 16.2, 9, 1.1, 0.5, PALETTE.wood);

      // flank courtyard: crenellations on the walkway
      const fx = s * 34;
      for (let i = -8; i <= 8; i += 4) {
        deco(fx + i, 5.2, -12, 2.2, 1.0, 2.2, PALETTE.sandDark);
        deco(fx + i, 5.2, 12, 2.2, 1.0, 2.2, PALETTE.sandDark);
      }
      // gate lintel and awning over the courtyard entrance
      deco(fx - s * 8.5, 4.6, 0, 2.2, 0.8, 16, PALETTE.wood);
      deco(fx - s * 10.5, 3.9, 0, 3.2, 0.3, 9, PALETTE.cloth);

      // market stall awnings around the tower
      deco(s * 14, 3.0, s * 13, 7.4, 0.3, 7.4, PALETTE.cloth);
      deco(-s * 15, 3.8, s * 14, 6.4, 0.3, 6.4, PALETTE.cloth);
    });

    // tower: cornice, niches, canopy trim
    deco(0, 4.6, 0, 17, 0.6, 17, PALETTE.wood);
    // framed niches on each face of the tower base, so the walls are not blank
    for (const [nx, nz, nw, nd] of [[0, 8.1, 2.4, 0.3], [0, -8.1, 2.4, 0.3], [8.1, 0, 0.3, 2.4], [-8.1, 0, 0.3, 2.4]]) {
      // the recess is solid: a bullet that flew through a panel this large and this
      // flat would visibly pass through the wall in front of the player
      this.box(nx, 1.5, nz, nw, 2.4, nd, 0x3a2f24);                              // recess
      deco(nx, 1.5, nz, nw + 0.5, 0.3, nd + 0.1, PALETTE.wood);                  // sill
      deco(nx, 3.9, nz, nw + 0.5, 0.35, nd + 0.1, PALETTE.wood);                 // lintel
      if (nw > nd) {
        deco(nx - nw / 2 - 0.12, 1.5, nz, 0.25, 2.4, nd + 0.1, PALETTE.wood);    // jambs
        deco(nx + nw / 2 + 0.12, 1.5, nz, 0.25, 2.4, nd + 0.1, PALETTE.wood);
      } else {
        deco(nx, 1.5, nz - nd / 2 - 0.12, nw + 0.1, 2.4, 0.25, PALETTE.wood);
        deco(nx, 1.5, nz + nd / 2 + 0.12, nw + 0.1, 2.4, 0.25, PALETTE.wood);
      }
    }
    deco(0, 8.6, 0, 15.6, 0.35, 15.6, PALETTE.wood);

    // sand drifts on the ground for tonal variation
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 40;
      // own material instance: mutating the cached one would tint every other
      // surface that happens to share this colour
      if (!this.driftMaterial) {
        this.driftMaterial = this.mats.color(0xc9a367, { roughness: 1 }).clone();
        this.driftMaterial.transparent = true;
        this.driftMaterial.opacity = 0.35;
      }
      const drift = new THREE.Mesh(new THREE.CircleGeometry(3 + Math.random() * 7, 12), this.driftMaterial);
      drift.rotation.x = -Math.PI / 2;
      drift.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      drift.receiveShadow = true;
      this.group.add(drift);
      this.mergeable.push(drift);
    }

    // distant dunes outside the arena so the horizon is not empty sky
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.15;
      const r = 90 + Math.random() * 60;
      const hill = new THREE.Mesh(
        new THREE.IcosahedronGeometry(16 + Math.random() * 22, 1),
        this.mats.color(0xcfae7d, { flatShading: true, roughness: 1 })
      );
      hill.position.set(Math.cos(a) * r, -6 - Math.random() * 6, Math.sin(a) * r);
      hill.scale.y = 0.45;
      this.group.add(hill);
      this.mergeable.push(hill);
    }
  }

  buildCapturePoints() {
    const defs = [
      { id: 'A', pos: new THREE.Vector3(-34, 0, 0) },
      { id: 'B', pos: new THREE.Vector3(0, 5.7, 0) },
      { id: 'C', pos: new THREE.Vector3(34, 0, 0) },
    ];
    for (const d of defs) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(6.5, 6.5, 0.12, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      ring.position.copy(d.pos).add(new THREE.Vector3(0, 0.9, 0));
      this.group.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 14, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.copy(d.pos).add(new THREE.Vector3(0, 7, 0));
      this.group.add(beam);

      this.points.push({
        id: d.id,
        pos: d.pos.clone(),
        owner: null,
        progress: 0,         // -1 .. 1 (alpha .. bravo)
        contested: false,
        ring, beam,
      });
    }
  }

  buildWaypoints() {
    // The nav mesh is generated, not hand placed: probe a grid for walkable floor,
    // add a second layer for roofs/walkways, then link neighbours that can see
    // each other and are close enough in height to walk between.
    const step = 3, extent = 48;
    const nodes = [];

    for (let x = -extent; x <= extent; x += step) {
      for (let z = -extent; z <= extent; z += step) {
        // every stacked surface is a candidate floor: ground, balcony, roof, ...
        for (const y of this.surfacesAt(x, z)) {
          if (this.isFree(x, y, z)) nodes.push(new THREE.Vector3(x, y + 1.0, z));
        }
      }
    }

    const links = nodes.map(() => []);
    const maxSpan = step * 1.55;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (Math.abs(a.x - b.x) > maxSpan || Math.abs(a.z - b.z) > maxSpan) continue;
        const dy = Math.abs(a.y - b.y);
        if (dy > 1.3) {
          // steeper than a normal step: only allow it when there is an
          // intermediate surface halfway, i.e. an actual staircase or ramp
          if (dy > 2.4) continue;
          const lo = Math.min(a.y, b.y) - 1, hi = Math.max(a.y, b.y) - 1;
          const mid = this.surfacesAt((a.x + b.x) / 2, (a.z + b.z) / 2);
          if (!mid.some((h) => h > lo + 0.15 && h < hi - 0.15)) continue;
        }
        const dist = a.distanceTo(b);
        if (dist > maxSpan) continue;
        if (!this.lineOfSight(a, b)) continue;
        links[i].push({ to: j, cost: dist + dy * 1.5 });
        links[j].push({ to: i, cost: dist + dy * 1.5 });
      }
    }

    // keep only the biggest connected component so bots never target an island
    const comp = new Array(nodes.length).fill(-1);
    let bestId = -1, bestSize = 0, id = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (comp[i] >= 0) continue;
      const stack = [i];
      comp[i] = id;
      let size = 0;
      while (stack.length) {
        const n = stack.pop();
        size++;
        for (const e of links[n]) if (comp[e.to] < 0) { comp[e.to] = id; stack.push(e.to); }
      }
      if (size > bestSize) { bestSize = size; bestId = id; }
      id++;
    }

    const remap = new Map();
    this.waypoints = [];
    for (let i = 0; i < nodes.length; i++) {
      if (comp[i] !== bestId) continue;
      remap.set(i, this.waypoints.length);
      this.waypoints.push(nodes[i]);
    }
    this.graph = this.waypoints.map(() => []);
    for (const [oldIdx, newIdx] of remap) {
      for (const e of links[oldIdx]) {
        const t = remap.get(e.to);
        if (t != null) this.graph[newIdx].push({ to: t, cost: e.cost });
      }
    }
  }

  /**
   * Batches every static piece into one mesh per material. Phone GPUs are limited by
   * draw calls long before they run out of triangles, and the map is built from
   * hundreds of small boxes that never move — exactly the case batching is for.
   */
  batchStatics() {
    const byMaterial = new Map();
    for (const mesh of this.mergeable) {
      if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
      byMaterial.get(mesh.material).push(mesh);
    }

    let merged = 0, removed = 0;
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => {
        // rounded boxes arrive non-indexed, cylinders indexed — merging needs one or
        // the other throughout, so everything is normalised to non-indexed here
        const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        m.updateMatrixWorld(true);
        geo.applyMatrix4(m.matrixWorld);
        return geo;
      });
      const batch = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!batch) continue;

      const mesh = new THREE.Mesh(batch, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      merged++;

      for (const m of meshes) {
        this.group.remove(m);
        m.geometry.dispose();
        removed++;
      }
    }
    this.batchStats = { batches: merged, replaced: removed };
    this.mergeable.length = 0;
  }

  // ---------------------------------------------------------------- queries

  /** Height of the highest surface below `fromY` at (x, z), or null if there is none. */
  floorAt(x, z, fromY) {
    let best = fromY >= 0 ? 0 : null;          // the ground plane
    for (const c of this.colliders) {
      if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
      if (c.max.y <= fromY && (best == null || c.max.y > best)) best = c.max.y;
    }
    return best;
  }

  /**
   * Every candidate standing height in the column at (x, z): the ground plus the
   * top face of each collider covering that spot. Read straight from the collider
   * list — repeated downward rays would get stuck inside thin slabs.
   */
  surfacesAt(x, z) {
    const tops = new Set([0]);
    for (const c of this.colliders) {
      if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
      tops.add(+c.max.y.toFixed(2));
    }
    return [...tops].sort((a, b) => a - b);
  }

  /**
   * Can a fighter stand with their feet at (x, y, z)? Uses a slim probe radius and
   * ignores knee-high geometry — otherwise no point on a staircase would ever count
   * as walkable, because the next step always clips a full-width body box.
   */
  isFree(x, y, z) {
    const r = 0.25, head = 1.85, stepUp = 0.68;
    for (const c of this.colliders) {
      if (x + r <= c.min.x || x - r >= c.max.x) continue;
      if (z + r <= c.min.z || z - r >= c.max.z) continue;
      if (c.max.y <= y + stepUp) continue;          // low enough to step onto
      if (c.min.y >= y + head) continue;            // clears the head
      if (c.max.y <= y + 0.05) continue;
      return false;
    }
    return true;
  }

  groundHeightAt(x, z, maxY = 30) {
    const y = this.floorAt(x, z, maxY);
    return y == null ? 0 : y;
  }

  /**
   * Raycast against static geometry. Tests the collider boxes analytically instead of
   * walking mesh triangles: exact for box geometry, far cheaper per ray, and it stays
   * correct now that the visual meshes are batched. Returns {point, distance, normal}.
   */
  raycast(origin, dir, maxDist = 250) {
    let bestT = maxDist;
    let bestNormal = null;

    for (const c of this.colliders) {
      const hit = rayAABB(origin, dir, c.min, c.max, bestT);
      if (hit) { bestT = hit.t; bestNormal = hit.normal; }
    }

    if (dir.y < -1e-6) {                       // ground plane at y = 0
      const t = -origin.y / dir.y;
      if (t > 0 && t < bestT) { bestT = t; bestNormal = GROUND_NORMAL; }
    }

    if (!bestNormal) return null;
    return {
      point: origin.clone().addScaledVector(dir, bestT),
      distance: bestT,
      normal: bestNormal.clone(),
    };
  }

  lineOfSight(a, b) {
    const dir = _dir.subVectors(b, a);
    const dist = dir.length();
    if (dist < 0.001) return true;
    dir.divideScalar(dist);
    return !this.raycast(a, dir, dist - 0.15);
  }

  /** Nearest nav node to a position (nodes on the same floor win). */
  nearestWaypoint(pos) {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.waypoints.length; i++) {
      const w = this.waypoints[i];
      const dy = Math.abs(w.y - pos.y - 1);
      const d = w.distanceToSquared(pos) + dy * dy * 6;
      if (d < bestScore) { bestScore = d; best = i; }
    }
    return best;
  }

  /** A* over the nav grid. Returns an array of Vector3 waypoints. */
  findPath(from, to) {
    const start = this.nearestWaypoint(from);
    const goal = this.nearestWaypoint(to);
    if (start < 0 || goal < 0) return [];
    if (start === goal) return [this.waypoints[goal].clone()];

    const n = this.waypoints.length;
    const g = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const goalPos = this.waypoints[goal];
    const heap = new MinHeap();

    g[start] = 0;
    heap.push(start, this.waypoints[start].distanceTo(goalPos));

    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      for (const edge of this.graph[cur]) {
        const tentative = g[cur] + edge.cost;
        if (tentative < g[edge.to]) {
          g[edge.to] = tentative;
          prev[edge.to] = cur;
          heap.push(edge.to, tentative + this.waypoints[edge.to].distanceTo(goalPos));
        }
      }
    }

    if (prev[goal] < 0) return [];
    const path = [];
    let node = goal;
    let guard = 0;
    while (node >= 0 && guard++ < 500) {
      path.unshift(this.waypoints[node].clone());
      node = prev[node];
    }
    return path;
  }

  randomSpawn(team, avoid = []) {
    const list = this.spawns[team];
    let best = list[0], bestScore = -Infinity;
    for (const s of list) {
      let score = Math.random() * 4;
      for (const enemy of avoid) score += Math.min(s.distanceTo(enemy), 60) * 0.5;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best.clone();
  }
}

export { PALETTE };

/** Tiny binary heap used by the path finder. */
class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, prio) {
    this.items.push(item); this.prio.push(prio);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prio[p] <= this.prio[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop() {
    const top = this.items[0];
    const lastItem = this.items.pop(), lastPrio = this.prio.pop();
    if (this.items.length) {
      this.items[0] = lastItem; this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < this.items.length && this.prio[l] < this.prio[s]) s = l;
        if (r < this.items.length && this.prio[r] < this.prio[s]) s = r;
        if (s === i) break;
        this.swap(i, s); i = s;
      }
    }
    return top;
  }
  swap(a, b) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}
