// Bot AI: waypoint navigation, target selection, burst fire and class abilities.

import * as THREE from 'three';
import { Fighter } from './entities.js';
import { MODES } from './config.js';

const THINK_INTERVAL = 0.18;

export class Bot extends Fighter {
  constructor(game, opts) {
    super(game, opts);
    this.skill = game.difficulty;
    this.maxHp = Math.round(this.cls.hp * this.skill.hpScale);
    this.hp = this.maxHp;

    this.target = null;
    this.lastSeenAt = -99;
    this.lastSeenPos = null;
    this.nextThink = Math.random() * THINK_INTERVAL;
    this.path = [];
    this.pathIndex = 0;
    this.repathAt = 0;
    this.aimOffset = new THREE.Vector2();
    this.burstUntil = 0;
    this.burstPauseUntil = 0;
    this.reactionUntil = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeUntil = 0;
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.goal = null;
  }

  update(dt) {
    if (!this.alive) return;

    this.nextThink -= dt;
    if (this.nextThink <= 0) {
      this.nextThink = THINK_INTERVAL;
      this.think();
    }

    this.updateAbility(dt);
    this.updateReload();
    this.regenerate(dt);
    this.act(dt);
    this.moveAndCollide(dt);
    this.syncMesh(dt);
  }

  // ------------------------------------------------------------- decisions

  canSee(other) {
    if (!other.alive) return false;
    const d = this.pos.distanceTo(other.pos);
    if (d > 75) return false;
    if (other.cloaked && d > 9) return false;
    if (other.marked > this.game.time && d < 60) return true;
    const from = this.eye;
    const to = other.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    // rough facing check keeps bots from having eyes in the back of the head
    const dir = to.clone().sub(from).normalize();
    const facing = dir.dot(this.forward());
    if (facing < -0.35 && d > 12) return false;
    return this.game.world.lineOfSight(from, to);
  }

  think() {
    const enemies = this.game.fighters.filter((f) => f.team !== this.team && f.alive);
    let best = null, bestScore = -Infinity;
    for (const e of enemies) {
      if (!this.canSee(e)) continue;
      const d = this.pos.distanceTo(e.pos);
      let score = 100 - d;
      if (e === this.target) score += 15;
      if (e.hp < e.maxHp * 0.4) score += 20;
      if (e.isPlayer) score += 6;
      if (score > bestScore) { bestScore = score; best = e; }
    }

    if (best) {
      if (this.target !== best) this.reactionUntil = this.game.time + this.skill.reaction;
      this.target = best;
      this.lastSeenAt = this.game.time;
      this.lastSeenPos = best.pos.clone();
    } else if (this.game.time - this.lastSeenAt > 3.5) {
      this.target = null;
    }

    this.pickGoal();
    this.maybeUseAbility();
  }

  pickGoal() {
    const world = this.game.world;
    let goal = null;

    if (this.game.arena.mode.id === 'domination') {
      let bestScore = -Infinity;
      for (const p of world.points) {
        let score = 60 - this.pos.distanceTo(p.pos) * 0.6;
        if (p.owner === this.team) score -= 35;
        if (p.owner === null) score += 20;
        if (p.contested) score += 25;
        if (score > bestScore) { bestScore = score; goal = p.pos.clone(); }
      }
    }

    if (!goal) {
      if (this.target) goal = this.target.pos.clone();
      else if (this.lastSeenPos && this.game.time - this.lastSeenAt < 8) goal = this.lastSeenPos.clone();
      else {
        const enemies = this.game.fighters.filter((f) => f.team !== this.team && f.alive);
        if (enemies.length) {
          const nearest = enemies.reduce((a, b) =>
            a.pos.distanceTo(this.pos) < b.pos.distanceTo(this.pos) ? a : b);
          goal = nearest.pos.clone();
        } else {
          goal = new THREE.Vector3(0, 0, 0);
        }
      }
    }

    const needsRepath = !this.goal || this.goal.distanceTo(goal) > 8 ||
      this.path.length === 0 || this.game.time > this.repathAt;
    this.goal = goal;
    if (needsRepath) {
      this.repathAt = this.game.time + 1.6 + Math.random();
      if (this.pos.distanceTo(goal) < 14 && this.game.world.lineOfSight(this.eye, goal.clone().setY(goal.y + 1))) {
        this.path = [goal.clone()];
      } else {
        this.path = this.game.world.findPath(this.pos, goal);
        if (this.path.length) this.path.push(goal.clone());
      }
      this.pathIndex = 0;
    }
  }

  maybeUseAbility() {
    if (!this.abilityReady()) return;
    const id = this.cls.ability.id;
    const hurt = this.hp < this.maxHp * 0.55;
    const targetDist = this.target ? this.pos.distanceTo(this.target.pos) : Infinity;

    switch (id) {
      case 'grenade':
        if (this.target && targetDist > 8 && targetDist < 32 && Math.random() < 0.6) {
          const saved = this.pitch;
          this.pitch += 0.12;     // lob it a bit
          this.useAbility();
          this.pitch = saved;
        }
        break;
      case 'bulwark':
        if (this.target && (hurt || targetDist < 22)) this.useAbility();
        break;
      case 'heal': {
        const allies = this.game.fighters.filter((f) =>
          f.team === this.team && f.alive && f.hp < f.maxHp * 0.7 &&
          f.pos.distanceTo(this.pos) < this.cls.ability.radius);
        if (hurt || allies.length >= 1) this.useAbility();
        break;
      }
      case 'recon':
        if (!this.target && Math.random() < 0.35) this.useAbility();
        break;
      case 'cloak':
        if (hurt || (!this.target && Math.random() < 0.25)) this.useAbility();
        break;
      default:
        break;
    }
  }

  // --------------------------------------------------------------- acting

  act(dt) {
    const now = this.game.time;
    const engaged = this.target && this.canSee(this.target);

    // ---- aim
    if (this.target) {
      const aimAt = this.target.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
      // lead the shot a little so strafing players are not free kills
      aimAt.addScaledVector(this.target.vel, Math.min(0.25, this.pos.distanceTo(this.target.pos) / 240));

      const to = aimAt.clone().sub(this.eye);
      const dist = to.length();
      const wantYaw = Math.atan2(-to.x, -to.z);
      const wantPitch = Math.asin(THREE.MathUtils.clamp(to.y / dist, -1, 1));

      const errScale = this.skill.aimError * (1 + dist / 60 * this.skill.accuracyFalloff);
      if (now > this.nextAimJitter || this.nextAimJitter === undefined) {
        this.nextAimJitter = now + 0.25 + Math.random() * 0.3;
        this.aimOffset.set(
          (Math.random() - 0.5) * THREE.MathUtils.degToRad(errScale) * 2,
          (Math.random() - 0.5) * THREE.MathUtils.degToRad(errScale)
        );
      }

      const turn = Math.min(1, dt * (engaged ? 9 : 4));
      this.yaw = lerpAngle(this.yaw, wantYaw + this.aimOffset.x, turn);
      this.pitch = THREE.MathUtils.lerp(this.pitch, wantPitch + this.aimOffset.y, turn);
    } else if (this.path.length) {
      const wp = this.path[Math.min(this.pathIndex, this.path.length - 1)];
      const to = wp.clone().sub(this.pos);
      const wantYaw = Math.atan2(-to.x, -to.z);
      this.yaw = lerpAngle(this.yaw, wantYaw, Math.min(1, dt * 5));
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 3);
    }

    // ---- movement
    const wish = new THREE.Vector3();
    const forward = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let advance = true;
    if (engaged) {
      const d = this.pos.distanceTo(this.target.pos);
      const ideal = this.cls.id === 'sniper' ? 34 : this.cls.id === 'stealth' ? 6 : 16;
      if (d < ideal - 4) advance = false;
      if (now > this.strafeUntil) {
        this.strafeUntil = now + 0.8 + Math.random() * 1.2;
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      wish.addScaledVector(right, this.strafeDir * 0.8);
      wish.addScaledVector(forward, advance ? 0.7 : -0.7);
    } else if (this.path.length) {
      // string pulling: jump ahead to the furthest node we can see
      let look = this.pathIndex;
      for (let k = 0; k < 3 && look + 1 < this.path.length; k++) {
        const cand = this.path[look + 1];
        if (Math.abs(cand.y - this.pos.y) > 2.2) break;
        if (!this.game.world.lineOfSight(this.eye, cand)) break;
        look++;
      }
      this.pathIndex = look;

      const wp = this.path[Math.min(this.pathIndex, this.path.length - 1)];
      const flat = new THREE.Vector3(wp.x - this.pos.x, 0, wp.z - this.pos.z);
      if (flat.length() < 1.8) {
        if (this.pathIndex < this.path.length - 1) this.pathIndex++;
        else this.repathAt = 0;
      }
      wish.copy(flat).normalize();
    } else if (this.goal) {
      // no path (isolated spot): steer straight at the goal so we never freeze
      wish.set(this.goal.x - this.pos.x, 0, this.goal.z - this.pos.z);
      if (wish.lengthSq() > 0.001) wish.normalize();
    }

    if (wish.lengthSq() > 0) wish.normalize();
    this.applyMoveInput(wish, dt, engaged ? 0.92 : 1);

    // ---- unstick: jump or pick a new path when we barely moved
    if (this.pos.distanceTo(this.lastPos) < 0.06) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.45) {
        this.jump();
        this.yaw += (Math.random() - 0.5) * 1.4;
        this.repathAt = 0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
      this.lastPos.copy(this.pos);
    }

    // small ledges: hop when something low is right in front of us
    if (this.onGround && wish.lengthSq() > 0 && Math.random() < dt * 1.5) {
      const probe = this.game.world.raycast(
        this.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), wish.clone().normalize(), 1.3);
      if (probe) this.jump();
    }

    // ---- shooting
    if (engaged && now > this.reactionUntil) {
      const d = this.pos.distanceTo(this.target.pos);
      const inRange = d < this.weapon.range * 0.95;
      const aimAt = this.target.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
      const dir = aimAt.clone().sub(this.eye).normalize();
      const onTarget = dir.dot(this.aimDirection(0)) > (d > 30 ? 0.995 : 0.97);

      if (inRange && onTarget) {
        if (now > this.burstPauseUntil) {
          if (now > this.burstUntil) {
            const [minB, maxB] = this.skill.burst;
            this.burstUntil = now + minB + Math.random() * (maxB - minB);
            this.burstPauseUntil = 0;
          }
          if (this.fire() && this.cloaked) {
            this.cloaked = false;
            this.abilityUntil = 0;
            this.setOpacity(1);
          }
          if (now > this.burstUntil) {
            this.burstPauseUntil = now + 0.25 + Math.random() * 0.45;
            this.burstUntil = 0;
          }
        }
      }
    }

    if (this.ammo <= 0 && !this.reloading) this.startReload();
    if (!engaged && this.ammo < this.weapon.mag * 0.35 && !this.reloading) this.startReload();
  }
}

function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export { MODES };
