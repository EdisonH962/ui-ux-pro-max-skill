// Pooled visual effects: tracers, muzzle flashes, impacts, blood, rings, booms.

import * as THREE from 'three';
import { TEAMS } from './config.js';

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,220,1)');
  grad.addColorStop(0.4, 'rgba(255,190,80,0.7)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function bulletHoleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(20,16,12,0.95)');
  grad.addColorStop(0.35, 'rgba(45,38,30,0.75)');
  grad.addColorStop(0.7, 'rgba(120,105,85,0.35)');
  grad.addColorStop(1, 'rgba(160,145,120,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 9; i++) {          // radial cracks
    const a = Math.random() * Math.PI * 2;
    const len = 8 + Math.random() * 18;
    g.strokeStyle = 'rgba(30,24,18,0.5)';
    g.lineWidth = 1 + Math.random();
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(32 + Math.cos(a) * len, 32 + Math.sin(a) * len);
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

const DECAL_LIMIT = 40;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.flashTex = flashTexture();

    this.tracerPool = [];
    this.spritePool = [];
    this.boxPool = [];

    // All bullet holes live in one instanced mesh: any number of impact marks
    // costs exactly one draw call, which is what makes them affordable on phones.
    this.decals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: bulletHoleTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
      DECAL_LIMIT
    );
    this.decals.frustumCulled = false;
    this.decals.count = DECAL_LIMIT;
    this.decalIndex = 0;
    this._decalMatrix = new THREE.Matrix4();
    this._decalObject = new THREE.Object3D();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < DECAL_LIMIT; i++) this.decals.setMatrixAt(i, hidden);
    this.decals.instanceMatrix.needsUpdate = true;
    scene.add(this.decals);
  }

  /** Stamps a bullet hole onto a surface, recycling the oldest slot. */
  decal(point, normal, size = 0.3) {
    if (!normal) return;
    const o = this._decalObject;
    o.position.copy(point).addScaledVector(normal, 0.02);
    o.lookAt(point.clone().addScaledVector(normal, 1));
    o.rotateZ(Math.random() * Math.PI * 2);
    const s = size * (0.75 + Math.random() * 0.6);
    o.scale.set(s, s, s);
    o.updateMatrix();
    this.decals.setMatrixAt(this.decalIndex, o.matrix);
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalIndex = (this.decalIndex + 1) % DECAL_LIMIT;
  }

  clearDecals() {
    const hidden = this._decalMatrix.makeScale(0, 0, 0);
    for (let i = 0; i < DECAL_LIMIT; i++) this.decals.setMatrixAt(i, hidden);
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalIndex = 0;
  }

  // ------------------------------------------------------------ pool utils

  takeTracer() {
    let line = this.tracerPool.pop();
    if (!line) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      line = new THREE.Line(geo, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }));
      line.frustumCulled = false;
    }
    this.scene.add(line);
    return line;
  }

  takeSprite() {
    let spr = this.spritePool.pop();
    if (!spr) {
      spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    }
    this.scene.add(spr);
    return spr;
  }

  takeBox(color) {
    let m = this.boxPool.pop();
    if (!m) {
      m = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
      );
    }
    m.material.color.set(color);
    m.material.opacity = 1;
    this.scene.add(m);
    return m;
  }

  release(obj, pool) {
    this.scene.remove(obj);
    pool.push(obj);
  }

  // -------------------------------------------------------------- effects

  tracer(from, to, team) {
    const line = this.takeTracer();
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    line.material.color.set(team ? TEAMS[team].color : 0xfff0a0);
    line.material.opacity = 0.9;
    this.active.push({ obj: line, pool: this.tracerPool, life: 0.07, t: 0, kind: 'tracer' });
  }

  muzzleFlash(pos, team) {
    const spr = this.takeSprite();
    spr.position.copy(pos);
    spr.scale.setScalar(1.1);
    spr.material.opacity = 1;
    spr.material.rotation = Math.random() * Math.PI;
    this.active.push({ obj: spr, pool: this.spritePool, life: 0.06, t: 0, kind: 'flash' });
  }

  impact(point, normal) {
    this.decal(point, normal);
    for (let i = 0; i < 4; i++) {
      const m = this.takeBox(0xd9c39a);
      m.position.copy(point);
      m.scale.setScalar(0.4 + Math.random() * 0.6);
      const vel = (normal ? normal.clone() : new THREE.Vector3(0, 1, 0))
        .multiplyScalar(2 + Math.random() * 3)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(3));
      this.active.push({ obj: m, pool: this.boxPool, life: 0.4, t: 0, kind: 'debris', vel, gravity: 14 });
    }
    const spr = this.takeSprite();
    spr.position.copy(point);
    spr.scale.setScalar(0.5);
    this.active.push({ obj: spr, pool: this.spritePool, life: 0.08, t: 0, kind: 'flash' });
  }

  bloodPuff(point) {
    for (let i = 0; i < 5; i++) {
      const m = this.takeBox(0xd8443a);
      m.position.copy(point);
      m.scale.setScalar(0.5 + Math.random() * 0.5);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).multiplyScalar(4);
      this.active.push({ obj: m, pool: this.boxPool, life: 0.35, t: 0, kind: 'debris', vel, gravity: 10 });
    }
  }

  ring(pos, color) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.9, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
    this.scene.add(mesh);
    this.active.push({ obj: mesh, life: 0.6, t: 0, kind: 'ring', dispose: true });
  }

  explosion(pos, radius) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, depthWrite: false })
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.active.push({ obj: mesh, life: 0.45, t: 0, kind: 'boom', radius, dispose: true });

    for (let i = 0; i < 18; i++) {
      const m = this.takeBox(i % 2 ? 0xffd479 : 0x4a4a4a);
      m.position.copy(pos);
      m.scale.setScalar(0.8 + Math.random());
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5)
        .normalize().multiplyScalar(8 + Math.random() * 10);
      this.active.push({ obj: m, pool: this.boxPool, life: 0.9, t: 0, kind: 'debris', vel, gravity: 18 });
    }
  }

  deathBurst(pos, team) {
    for (let i = 0; i < 14; i++) {
      const m = this.takeBox(TEAMS[team].color);
      m.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
      m.scale.setScalar(1 + Math.random() * 1.2);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5)
        .normalize().multiplyScalar(5 + Math.random() * 5);
      this.active.push({ obj: m, pool: this.boxPool, life: 0.8, t: 0, kind: 'debris', vel, gravity: 16 });
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.life);

      if (e.kind === 'debris') {
        e.vel.y -= e.gravity * dt;
        e.obj.position.addScaledVector(e.vel, dt);
        e.obj.rotation.x += dt * 8;
        e.obj.rotation.y += dt * 6;
        e.obj.material.opacity = 1 - k;
      } else if (e.kind === 'tracer' || e.kind === 'flash') {
        e.obj.material.opacity = 1 - k;
      } else if (e.kind === 'ring') {
        const s = 1 + k * 8;
        e.obj.scale.set(s, s, s);
        e.obj.material.opacity = 0.7 * (1 - k);
      } else if (e.kind === 'boom') {
        const s = 0.5 + k * e.radius;
        e.obj.scale.set(s, s, s);
        e.obj.material.opacity = 0.85 * (1 - k);
      }

      if (e.t >= e.life) {
        if (e.dispose) {
          this.scene.remove(e.obj);
          e.obj.geometry.dispose();
          e.obj.material.dispose();
        } else {
          this.release(e.obj, e.pool);
        }
        this.active.splice(i, 1);
      }
    }
  }
}
