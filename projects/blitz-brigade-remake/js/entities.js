// Fighter = anything that can shoot and die (the player and every bot).
// Contains the blocky cartoon character mesh, movement/collision, and shooting.

import * as THREE from 'three';
import { PHYSICS, RULES, TEAMS, ENEMY_OF } from './config.js';

const SKIN = 0xd9a271;
const GEAR = 0x38424f;

const CLASS_ACCENT = {
  soldier: 0x6f7a50,
  gunner: 0x8a6034,
  medic: 0xe8f3f5,
  sniper: 0x4c5a3a,
  stealth: 0x2c3138,
};

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function part(group, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

/** Blocky, TF2-ish soldier built entirely from boxes. */
export function makeFighterMesh(teamColor, classId) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const teamMat = mat(teamColor);
  const gearMat = mat(GEAR);
  const skinMat = mat(SKIN);
  const accentMat = mat(CLASS_ACCENT[classId] || 0x777777);

  const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.28);
  const legL = part(body, legGeo, gearMat, -0.16, 0.43, 0);
  const legR = part(body, legGeo, gearMat, 0.16, 0.43, 0);

  const torso = part(body, new THREE.BoxGeometry(0.72, 0.78, 0.44), teamMat, 0, 1.22, 0);
  part(body, new THREE.BoxGeometry(0.74, 0.34, 0.46), accentMat, 0, 0.98, 0);      // belt / webbing
  part(body, new THREE.BoxGeometry(0.5, 0.5, 0.24), accentMat, 0, 1.3, -0.3);      // backpack

  const head = part(body, new THREE.BoxGeometry(0.38, 0.36, 0.38), skinMat, 0, 1.79, 0);
  part(head, new THREE.BoxGeometry(0.44, 0.18, 0.44), teamMat, 0, 0.2, 0);          // helmet
  part(head, new THREE.BoxGeometry(0.3, 0.1, 0.06), mat(0x1c2330), 0, 0.02, 0.2);   // visor

  const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.22);
  const armL = part(body, armGeo, teamMat, -0.46, 1.28, 0.06);
  const armR = part(body, armGeo, teamMat, 0.46, 1.28, 0.06);

  // weapon held in front of the chest, class-flavoured silhouette
  const gun = new THREE.Group();
  gun.position.set(0.3, 1.24, 0.34);
  body.add(gun);
  const gunMat = mat(0x2f353d);
  if (classId === 'sniper') {
    part(gun, new THREE.BoxGeometry(0.1, 0.12, 1.5), gunMat, 0, 0, 0.45);
    part(gun, new THREE.BoxGeometry(0.08, 0.16, 0.34), gunMat, 0, 0.16, 0.25);
  } else if (classId === 'gunner') {
    part(gun, new THREE.BoxGeometry(0.22, 0.22, 1.1), gunMat, 0, 0, 0.35);
    part(gun, new THREE.BoxGeometry(0.3, 0.3, 0.3), accentMat, 0, 0, 0.0);
  } else if (classId === 'stealth') {
    part(gun, new THREE.BoxGeometry(0.16, 0.16, 0.8), gunMat, 0, 0, 0.3);
  } else if (classId === 'medic') {
    part(gun, new THREE.BoxGeometry(0.12, 0.2, 0.62), gunMat, 0, 0, 0.26);
  } else {
    part(gun, new THREE.BoxGeometry(0.13, 0.18, 0.95), gunMat, 0, 0, 0.32);
    part(gun, new THREE.BoxGeometry(0.1, 0.22, 0.2), gunMat, 0, -0.16, 0.1);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.95);
  gun.add(muzzle);

  root.userData.parts = { body, legL, legR, torso, head, armL, armR, gun, muzzle };
  root.userData.materials = [teamMat, gearMat, skinMat, accentMat, gunMat];
  return root;
}

function makeLabel(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  spr.scale.set(2.6, 0.65, 1);
  return spr;
}

/** Ray vs axis aligned box. Returns distance or null. */
export function rayBox(origin, dir, min, max) {
  let tmin = 0, tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
    } else {
      const inv = 1 / d;
      let t1 = (min[axis] - origin[axis]) * inv;
      let t2 = (max[axis] - origin[axis]) * inv;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

let nextId = 1;

export class Fighter {
  constructor(game, { team, cls, name, isPlayer = false }) {
    this.game = game;
    this.id = nextId++;
    this.team = team;
    this.cls = cls;
    this.name = name;
    this.isPlayer = isPlayer;

    this.maxHp = cls.hp;
    this.hp = cls.hp;
    this.alive = true;
    this.respawnAt = 0;
    this.spawnProtectedUntil = 0;
    this.lastDamageAt = -99;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;

    this.ammo = cls.weapon.mag;
    this.reloading = false;
    this.reloadEnd = 0;
    this.nextShotAt = 0;
    this.spin = 0;
    this.stepPhase = 0;

    this.abilityReadyAt = 0;
    this.abilityUntil = 0;
    this.cloaked = false;
    this.bulwark = false;
    this.marked = 0;

    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.score = 0;
    this.streak = 0;
    this.recentDamagers = new Map();

    this.mesh = makeFighterMesh(TEAMS[team].color, cls.id);
    this.mesh.visible = !isPlayer;
    game.scene.add(this.mesh);

    this.label = makeLabel(name, TEAMS[team].light);
    this.label.position.set(0, 2.55, 0);
    this.mesh.add(this.label);

    this.hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x101418, transparent: true, opacity: 0.8 })
    );
    this.hpBarBg.position.set(0, 2.25, 0);
    this.mesh.add(this.hpBarBg);
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.44, 0.11),
      new THREE.MeshBasicMaterial({ color: TEAMS[team].color })
    );
    this.hpBar.position.set(0, 2.25, 0.01);
    this.mesh.add(this.hpBar);
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + PHYSICS.eyeHeight, this.pos.z);
  }

  get weapon() { return this.cls.weapon; }
  get enemyTeam() { return ENEMY_OF[this.team]; }

  aimDirection(spreadDeg = 0) {
    const yaw = this.yaw + (Math.random() - 0.5) * THREE.MathUtils.degToRad(spreadDeg) * 2;
    const pitch = this.pitch + (Math.random() - 0.5) * THREE.MathUtils.degToRad(spreadDeg) * 2;
    return new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  hitboxes() {
    const p = this.pos;
    return [
      {
        part: 'head',
        min: new THREE.Vector3(p.x - 0.24, p.y + 1.58, p.z - 0.24),
        max: new THREE.Vector3(p.x + 0.24, p.y + 2.02, p.z + 0.24),
      },
      {
        part: 'body',
        min: new THREE.Vector3(p.x - 0.42, p.y + 0.0, p.z - 0.34),
        max: new THREE.Vector3(p.x + 0.42, p.y + 1.58, p.z + 0.34),
      },
    ];
  }

  // ------------------------------------------------------------- lifecycle

  spawn(position) {
    this.pos.copy(position);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.ammo = this.weapon.mag;
    this.reloading = false;
    this.spin = 0;
    this.cloaked = false;
    this.bulwark = false;
    this.marked = 0;
    this.abilityUntil = 0;
    this.recentDamagers.clear();
    this.spawnProtectedUntil = this.game.time + RULES.spawnProtection;
    this.mesh.visible = !this.isPlayer;
    this.setOpacity(1);
    this.syncMesh();
  }

  takeDamage(amount, attacker, partName = 'body') {
    if (!this.alive) return 0;
    if (this.game.time < this.spawnProtectedUntil && attacker !== this) return 0;
    let dmg = amount;
    if (this.bulwark) dmg *= 0.5;
    dmg = Math.round(dmg);
    this.hp -= dmg;
    this.lastDamageAt = this.game.time;
    if (attacker && attacker !== this) {
      this.recentDamagers.set(attacker, (this.recentDamagers.get(attacker) || 0) + dmg);
    }
    this.game.arena.onDamage(this, attacker, dmg, partName);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(attacker);
      return dmg;
    }
    return dmg;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  die(killer) {
    if (!this.alive) return;
    this.alive = false;
    this.deaths++;
    this.streak = 0;
    this.respawnAt = this.game.time + RULES.respawnDelay;
    this.mesh.visible = false;
    this.cloaked = false;
    this.bulwark = false;
    this.game.arena.onKill(killer, this);
  }

  // ------------------------------------------------------------- movement

  moveAndCollide(dt) {
    const world = this.game.world;
    const r = PHYSICS.playerRadius;
    const h = PHYSICS.playerHeight;

    this.vel.y -= PHYSICS.gravity * dt;
    if (this.vel.y < PHYSICS.maxFall) this.vel.y = PHYSICS.maxFall;

    const move = this.vel.clone().multiplyScalar(dt);
    const axes = ['x', 'z', 'y'];
    this.onGround = false;

    for (const axis of axes) {
      if (move[axis] === 0) continue;
      const before = this.pos[axis];
      this.pos[axis] += move[axis];

      const box = new THREE.Box3(
        new THREE.Vector3(this.pos.x - r, this.pos.y, this.pos.z - r),
        new THREE.Vector3(this.pos.x + r, this.pos.y + h, this.pos.z + r)
      );

      for (const c of world.colliders) {
        if (!box.intersectsBox(c)) continue;

        // step up small ledges when moving horizontally
        if (axis !== 'y') {
          const stepTop = c.max.y;
          if (stepTop - this.pos.y <= PHYSICS.stepHeight && stepTop - this.pos.y > 0) {
            const lifted = new THREE.Box3(
              new THREE.Vector3(box.min.x, stepTop + 0.02, box.min.z),
              new THREE.Vector3(box.max.x, stepTop + 0.02 + h, box.max.z)
            );
            let blocked = false;
            for (const c2 of world.colliders) {
              if (lifted.intersectsBox(c2)) { blocked = true; break; }
            }
            if (!blocked) { this.pos.y = stepTop + 0.02; this.onGround = true; continue; }
          }
          this.pos[axis] = before;
          this.vel[axis] *= 0.0;
          break;
        } else {
          if (move.y < 0) {
            this.pos.y = c.max.y;
            this.onGround = true;
          } else {
            this.pos.y = c.min.y - h - 0.01;
          }
          this.vel.y = 0;
          break;
        }
      }
    }

    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }

    const lim = 55;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
  }

  applyMoveInput(wish, dt, speedMul = 1) {
    const target = this.cls.speed * speedMul * (this.cloaked ? (this.cls.ability.speedBonus || 1) : 1);
    const accel = this.onGround ? PHYSICS.accel : PHYSICS.airAccel;
    const desired = wish.clone().multiplyScalar(target);
    const horiz = new THREE.Vector3(this.vel.x, 0, this.vel.z);

    if (wish.lengthSq() > 0.0001) {
      const delta = desired.sub(horiz);
      const maxDelta = accel * dt;
      if (delta.length() > maxDelta) delta.setLength(maxDelta);
      horiz.add(delta);
    } else if (this.onGround) {
      const drop = PHYSICS.friction * dt;
      const len = horiz.length();
      horiz.multiplyScalar(len > drop ? (len - drop) / len : 0);
    }

    this.vel.x = horiz.x;
    this.vel.z = horiz.z;
  }

  jump() {
    if (this.onGround) {
      this.vel.y = this.cls.jump;
      this.onGround = false;
    }
  }

  // ------------------------------------------------------------- shooting

  canFire() {
    if (!this.alive || this.reloading) return false;
    if (this.game.time < this.nextShotAt) return false;
    if (this.ammo <= 0) return false;
    return true;
  }

  currentSpread() {
    const w = this.weapon;
    const moving = new THREE.Vector3(this.vel.x, 0, this.vel.z).length() > 1.2;
    let spread = moving ? w.moveSpread : w.spread;
    if (this.isPlayer && this.scoped && w.scopedSpread != null) spread = w.scopedSpread;
    if (!this.onGround) spread *= 1.6;
    return spread;
  }

  startReload() {
    if (this.reloading || this.ammo === this.weapon.mag) return;
    this.reloading = true;
    this.reloadEnd = this.game.time + this.weapon.reload;
    this.spin = 0;
    if (this.isPlayer) this.game.audio.reload();
  }

  updateReload() {
    if (this.reloading && this.game.time >= this.reloadEnd) {
      this.reloading = false;
      this.ammo = this.weapon.mag;
    }
  }

  fire() {
    if (!this.canFire()) return false;
    const w = this.weapon;

    if (w.spinUp) {
      this.spin = Math.min(1, this.spin + 0.2);
      if (this.spin < 1 && this.game.time < this.nextShotAt + 0.05) {
        // still spinning: slow the first shots down
        this.nextShotAt = this.game.time + w.interval * (2.4 - this.spin);
      }
    }

    this.ammo--;
    this.nextShotAt = this.game.time + w.interval;
    this.spawnProtectedUntil = 0;     // shooting drops your own spawn shield

    const origin = this.eye;
    const spread = this.currentSpread();
    const pellets = w.pellets || 1;
    let hitSomething = false;
    let killed = false;

    for (let i = 0; i < pellets; i++) {
      const dir = this.aimDirection(i === 0 && pellets === 1 ? spread : spread);
      const res = this.game.arena.hitscan(this, origin, dir, w.range);
      if (res.fighter) {
        hitSomething = true;
        const dist = res.distance;
        const falloff = dist <= w.falloffStart ? 1 :
          THREE.MathUtils.lerp(1, w.falloffMin, Math.min(1, (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart)));
        let dmg = w.damage * falloff;
        if (res.part === 'head') dmg *= w.headshot;
        const before = res.fighter.alive;
        res.fighter.takeDamage(dmg, this, res.part);
        if (before && !res.fighter.alive) killed = true;
        this.game.fx.bloodPuff(res.point);
      } else if (res.point) {
        this.game.fx.impact(res.point, res.normal);
      }
      this.game.fx.tracer(this.muzzleWorldPos(), res.point || origin.clone().add(dir.multiplyScalar(w.range)), this.team);
    }

    this.game.audio.shot(w.sound, this.isPlayer ? null : this.distanceToPlayer());
    this.game.fx.muzzleFlash(this.muzzleWorldPos(), this.team);
    this.onFired(hitSomething, killed);

    if (this.ammo <= 0) this.startReload();
    return true;
  }

  onFired() { /* overridden by Player for recoil / hitmarker */ }

  muzzleWorldPos() {
    const parts = this.mesh.userData.parts;
    if (this.isPlayer) {
      const dir = this.aimDirection(0);
      return this.eye.clone().add(dir.multiplyScalar(0.8)).add(new THREE.Vector3(0, -0.1, 0));
    }
    const v = new THREE.Vector3();
    parts.muzzle.getWorldPosition(v);
    return v;
  }

  distanceToPlayer() {
    const p = this.game.player;
    return p ? this.pos.distanceTo(p.pos) : null;
  }

  // ------------------------------------------------------------- abilities

  abilityReady() { return this.game.time >= this.abilityReadyAt; }

  useAbility() {
    if (!this.alive || !this.abilityReady()) return false;
    const a = this.cls.ability;
    this.abilityReadyAt = this.game.time + a.cooldown;
    this.abilityUntil = this.game.time + (a.duration || 0);

    switch (a.id) {
      case 'cloak':
        this.cloaked = true;
        this.game.fx.ring(this.pos, 0x8fd4ff);
        break;
      case 'bulwark':
        this.bulwark = true;
        this.game.fx.ring(this.pos, 0xffc14d);
        break;
      case 'heal':
        this.healPulseUntil = this.abilityUntil;
        this.game.fx.ring(this.pos, 0x5ef58a);
        break;
      case 'recon':
        for (const f of this.game.fighters) {
          if (f.team !== this.team && f.alive) f.marked = this.abilityUntil;
        }
        this.game.fx.ring(this.pos, 0xffe066);
        break;
      case 'grenade':
        this.game.arena.throwGrenade(this);
        break;
      default:
        break;
    }
    this.game.audio.ability(a.id);
    return true;
  }

  updateAbility(dt) {
    const a = this.cls.ability;
    if (this.abilityUntil && this.game.time > this.abilityUntil) {
      if (this.cloaked) { this.cloaked = false; this.setOpacity(1); }
      this.bulwark = false;
      this.abilityUntil = 0;
    }
    if (a.id === 'heal' && this.healPulseUntil && this.game.time < this.healPulseUntil) {
      for (const f of this.game.fighters) {
        if (f.team === this.team && f.alive && f.pos.distanceTo(this.pos) < a.radius) {
          f.heal(a.healPerSec * dt);
        }
      }
    }
    if (this.cloaked) {
      const moving = new THREE.Vector3(this.vel.x, 0, this.vel.z).length();
      this.setOpacity(moving > 3 ? 0.28 : 0.12);
    }
  }

  setOpacity(o) {
    const visible = o >= 0.99;
    for (const m of this.mesh.userData.materials) {
      m.transparent = !visible;
      m.opacity = o;
      m.needsUpdate = true;
    }
    this.label.visible = visible;
    this.hpBar.visible = visible;
    this.hpBarBg.visible = visible;
  }

  regenerate(dt) {
    if (!this.alive) return;
    if (this.game.time - this.lastDamageAt < RULES.regenDelay) return;
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + RULES.regenRate * dt);
  }

  // ------------------------------------------------------------- rendering

  syncMesh(dt = 0) {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;

    const parts = this.mesh.userData.parts;
    const speed = new THREE.Vector3(this.vel.x, 0, this.vel.z).length();
    this.stepPhase += speed * dt * 2.2;
    const swing = Math.sin(this.stepPhase) * Math.min(0.6, speed * 0.09);
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.5 - 0.35;
    parts.armR.rotation.x = swing * 0.5 - 0.5;
    parts.gun.rotation.x = -this.pitch * 0.6;
    parts.head.rotation.x = -this.pitch * 0.6;

    // footstep audio for nearby fighters
    if (!this.isPlayer && speed > 2 && this.onGround) {
      const phase = Math.sin(this.stepPhase);
      if (this.lastStepSign !== undefined && Math.sign(phase) !== this.lastStepSign) {
        const d = this.distanceToPlayer();
        if (d != null && d < 22) this.game.audio.step(d);
      }
      this.lastStepSign = Math.sign(phase);
    }

    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scale.x = Math.max(0.001, ratio);
    this.hpBar.position.x = -(1 - ratio) * 0.72;

    const cam = this.game.camera;
    if (cam) {
      this.hpBar.lookAt(cam.position);
      this.hpBarBg.lookAt(cam.position);
    }

    // recon marking makes enemies glow through the dust
    const isMarked = this.marked > this.game.time;
    if (isMarked !== this._markedVisual) {
      this._markedVisual = isMarked;
      for (const m of this.mesh.userData.materials) {
        m.emissive = new THREE.Color(isMarked ? 0x552200 : 0x000000);
      }
    }
  }
}
