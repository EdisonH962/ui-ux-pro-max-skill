// Match logic: hit registration, scoring, killfeed, grenades, capture points.

import * as THREE from 'three';
import { RULES, MODES, TEAMS, ENEMY_OF } from './config.js';
import { rayBox } from './entities.js';

export class Arena {
  constructor(game) {
    this.game = game;
    this.scores = { alpha: 0, bravo: 0 };
    this.kills = { alpha: 0, bravo: 0 };
    this.grenades = [];
    this.events = [];          // killfeed entries
    this.notices = [];         // big centre messages
    this.matchOver = false;
    this.winner = null;
    this.timeLeft = 0;
  }

  reset(mode) {
    this.mode = mode;
    this.scores = { alpha: 0, bravo: 0 };
    this.kills = { alpha: 0, bravo: 0 };
    this.matchOver = false;
    this.winner = null;
    this.timeLeft = mode.timeLimit;
    this.events.length = 0;
    this.notices.length = 0;
    for (const g of this.grenades) this.game.scene.remove(g.mesh);
    this.grenades.length = 0;
    for (const p of this.game.world.points) {
      p.owner = null;
      p.progress = 0;
      p.contested = false;
    }
  }

  // ------------------------------------------------------------- shooting

  /**
   * Trace a shot through the world. Returns the closest fighter hit (if any),
   * otherwise the world impact point.
   */
  hitscan(shooter, origin, dir, range) {
    const worldHit = this.game.world.raycast(origin, dir, range);
    let best = null;
    let bestDist = worldHit ? worldHit.distance : range;

    for (const f of this.game.fighters) {
      if (f === shooter || !f.alive) continue;
      if (f.team === shooter.team) continue;
      for (const hb of f.hitboxes()) {
        const t = rayBox(origin, dir, hb.min, hb.max);
        if (t != null && t < bestDist) {
          bestDist = t;
          best = { fighter: f, part: hb.part, distance: t };
        }
      }
    }

    if (best) {
      return {
        fighter: best.fighter,
        part: best.part,
        distance: best.distance,
        point: origin.clone().addScaledVector(dir, best.distance),
        normal: dir.clone().negate(),
      };
    }
    if (worldHit) {
      return { fighter: null, part: null, distance: worldHit.distance, point: worldHit.point, normal: worldHit.normal };
    }
    return { fighter: null, part: null, distance: range, point: null, normal: null };
  }

  onDamage(victim, attacker, dmg, part) {
    const player = this.game.player;
    if (attacker === player && victim !== player) {
      this.game.hud.hitmarker(part === 'head', victim.hp <= 0);
      this.game.audio.hitmarker(victim.hp <= 0);
      this.game.hud.damageNumber(dmg, part === 'head');
    }
    if (victim === player) {
      this.game.hud.damageFlash(attacker ? attacker.pos : null);
    }
  }

  onKill(killer, victim) {
    const headshotFlag = false;
    victim.recentDamagers.forEach((amount, f) => {
      if (f !== killer && f.team !== victim.team) {
        f.assists++;
        f.score += RULES.assistScore;
      }
    });

    if (killer && killer !== victim && killer.team !== victim.team) {
      killer.kills++;
      killer.streak++;
      killer.score += RULES.killScore;
      this.kills[killer.team]++;
      if (this.mode.id === 'tdm') this.scores[killer.team]++;
    } else {
      // suicide / environmental
      this.kills[ENEMY_OF[victim.team]] += 0;
    }

    this.events.push({
      t: this.game.time,
      killer: killer ? killer.name : 'Welt',
      killerTeam: killer ? killer.team : null,
      victim: victim.name,
      victimTeam: victim.team,
      weapon: killer ? killer.cls.weapon.name : '',
      headshot: headshotFlag,
    });
    if (this.events.length > 8) this.events.shift();

    this.game.fx.deathBurst(victim.pos, victim.team);

    const player = this.game.player;
    if (killer === player) {
      this.game.audio.kill();
      if (killer.streak === 3) this.notice('DREIFACH-ABSCHUSS!');
      if (killer.streak === 5) this.notice('AMOKLAUF!');
      if (killer.streak === 8) this.notice('UNAUFHALTSAM!');
    } else if (victim === player) {
      this.game.audio.death();
      this.game.hud.setKillerInfo(killer && killer !== victim
        ? `Ausgeschaltet von ${killer.name} · ${killer.cls.name} · ${killer.cls.weapon.name} (${Math.round(killer.hp)} HP übrig)`
        : 'Ausgeschaltet');
    }
    this.checkWin();
  }

  notice(text, duration = 2.2) {
    this.notices.push({ text, until: this.game.time + duration });
  }

  // ------------------------------------------------------------- grenades

  throwGrenade(owner) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshLambertMaterial({ color: 0x3d4a2f, flatShading: true })
    );
    const origin = owner.eye.clone();
    const dir = owner.aimDirection(1.2);
    mesh.position.copy(origin).addScaledVector(dir, 0.8);
    mesh.castShadow = true;
    this.game.scene.add(mesh);

    this.grenades.push({
      mesh,
      owner,
      vel: dir.multiplyScalar(RULES.grenade.speed).add(new THREE.Vector3(0, 3.2, 0)),
      explodeAt: this.game.time + RULES.grenade.fuse,
    });
  }

  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 22 * dt;
      const next = g.mesh.position.clone().addScaledVector(g.vel, dt);

      const dir = next.clone().sub(g.mesh.position);
      const dist = dir.length();
      if (dist > 0.0001) {
        const hit = this.game.world.raycast(g.mesh.position, dir.clone().normalize(), dist + 0.22);
        if (hit) {
          const n = hit.normal.clone().normalize();
          g.mesh.position.copy(hit.point).addScaledVector(n, 0.22);
          g.vel.reflect(n).multiplyScalar(0.42);
        } else {
          g.mesh.position.copy(next);
        }
      }
      if (g.mesh.position.y < 0.22) {
        g.mesh.position.y = 0.22;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.7; g.vel.z *= 0.7;
      }
      g.mesh.rotation.x += dt * 9;
      g.mesh.rotation.z += dt * 7;

      if (this.game.time >= g.explodeAt) {
        this.explode(g.mesh.position.clone(), g.owner);
        this.game.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        g.mesh.material.dispose();
        this.grenades.splice(i, 1);
      }
    }
  }

  explode(pos, owner) {
    const { damage, radius } = RULES.grenade;
    this.game.fx.explosion(pos, radius);
    this.game.audio.explosion(this.game.player ? pos.distanceTo(this.game.player.pos) : null);
    this.game.hud.shake(0.5);

    for (const f of this.game.fighters) {
      if (!f.alive) continue;
      const centre = f.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
      const d = centre.distanceTo(pos);
      if (d > radius) continue;
      if (!this.game.world.lineOfSight(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), centre)) continue;
      const falloff = 1 - d / radius;
      const dmg = damage * falloff * falloff;
      if (f.team === owner.team && f !== owner) continue;    // no team damage
      f.takeDamage(f === owner ? dmg * 0.4 : dmg, owner, 'body');
    }
  }

  // ------------------------------------------------------- domination mode

  updatePoints(dt) {
    if (this.mode.id !== 'domination') return;
    const { captureSpeed, captureRadius, tickRate } = MODES.domination;

    for (const p of this.game.world.points) {
      let alpha = 0, bravo = 0;
      for (const f of this.game.fighters) {
        if (!f.alive) continue;
        const flat = new THREE.Vector2(f.pos.x - p.pos.x, f.pos.z - p.pos.z).length();
        if (flat < captureRadius && Math.abs(f.pos.y - p.pos.y) < 2.5) {
          if (f.team === 'alpha') alpha++; else bravo++;
        }
      }
      p.contested = alpha > 0 && bravo > 0;
      const net = alpha - bravo;
      if (net !== 0) {
        const dirSign = net > 0 ? -1 : 1;      // alpha pushes to -1, bravo to +1
        const speed = captureSpeed * Math.min(3, Math.abs(net)) ** 0.6;
        p.progress = THREE.MathUtils.clamp(p.progress + dirSign * speed * dt, -1, 1);
      }

      const prevOwner = p.owner;
      if (p.progress <= -1) p.owner = 'alpha';
      else if (p.progress >= 1) p.owner = 'bravo';
      else if ((p.owner === 'alpha' && p.progress > -0.999) || (p.owner === 'bravo' && p.progress < 0.999)) p.owner = null;

      if (p.owner !== prevOwner) {
        const col = p.owner ? TEAMS[p.owner].color : 0xffffff;
        p.ring.material.color.setHex(col);
        p.beam.material.color.setHex(col);
        p.ring.material.opacity = p.owner ? 0.55 : 0.35;
        if (p.owner) {
          const mine = this.game.player && p.owner === this.game.player.team;
          this.notice(`Punkt ${p.id} ${mine ? 'gesichert' : 'verloren'}`, 1.8);
          this.game.audio.capture(mine);
          for (const f of this.game.fighters) {
            if (f.alive && f.team === p.owner && f.pos.distanceTo(p.pos) < captureRadius + 2) {
              f.score += RULES.captureScore;
            }
          }
        }
      } else {
        const c = p.ring.material.color;
        const target = p.owner ? new THREE.Color(TEAMS[p.owner].color) : new THREE.Color(0xffffff);
        c.lerp(target, 0.1);
      }

      p.beam.material.opacity = p.contested ? 0.16 + Math.sin(this.game.time * 9) * 0.1 : 0.16;
    }

    for (const team of ['alpha', 'bravo']) {
      const owned = this.game.world.points.filter((p) => p.owner === team).length;
      if (owned > 0) this.scores[team] += owned * tickRate * dt;
    }
    this.checkWin();
  }

  // ----------------------------------------------------------------- flow

  checkWin() {
    if (this.matchOver) return;
    const limit = this.mode.scoreLimit;
    for (const team of ['alpha', 'bravo']) {
      if (this.scores[team] >= limit) this.endMatch(team);
    }
  }

  endMatch(winner) {
    this.matchOver = true;
    this.winner = winner;
    this.game.input.releaseLock();     // give the mouse back for the end screen
    const playerWon = this.game.player && this.game.player.team === winner;
    this.game.audio.matchEnd(playerWon);
    this.game.hud.showMatchEnd(winner, playerWon);
  }

  update(dt) {
    if (this.matchOver) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      const w = this.scores.alpha === this.scores.bravo ? null : (this.scores.alpha > this.scores.bravo ? 'alpha' : 'bravo');
      this.endMatch(w || 'alpha');
      return;
    }
    this.updateGrenades(dt);
    this.updatePoints(dt);
    this.notices = this.notices.filter((n) => n.until > this.game.time);
  }

  respawnPosition(team) {
    const enemies = this.game.fighters.filter((f) => f.team !== team && f.alive).map((f) => f.pos);
    return this.game.world.randomSpawn(team, enemies);
  }
}
