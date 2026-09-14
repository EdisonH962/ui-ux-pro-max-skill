// Heads-up display: health, ammo, ability, killfeed, minimap, scoreboard.

import * as THREE from 'three';
import { TEAMS, MODES } from './config.js';

const $ = (sel) => document.querySelector(sel);

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      root: $('#hud'),
      health: $('#health-fill'),
      healthText: $('#health-text'),
      ammo: $('#ammo-current'),
      ammoMag: $('#ammo-mag'),
      weapon: $('#weapon-name'),
      classChip: $('#class-chip'),
      abilityIcon: $('#ability-icon'),
      abilityName: $('#ability-name'),
      abilityCd: $('#ability-cooldown'),
      scoreAlpha: $('#score-alpha'),
      scoreBravo: $('#score-bravo'),
      barAlpha: $('#bar-alpha'),
      barBravo: $('#bar-bravo'),
      timer: $('#timer'),
      killfeed: $('#killfeed'),
      notice: $('#notice'),
      crosshair: $('#crosshair'),
      hitmarkerEl: $('#hitmarker'),
      minimap: $('#minimap'),
      scoreboard: $('#scoreboard'),
      respawn: $('#respawn'),
      respawnTime: $('#respawn-time'),
      killerInfo: $('#killer-info'),
      damageFlashEl: $('#damage-flash'),
      indicators: $('#damage-indicators'),
      floaters: $('#floaters'),
      pointsStrip: $('#points-strip'),
      matchEnd: $('#match-end'),
      matchEndTitle: $('#match-end-title'),
      matchEndSub: $('#match-end-sub'),
      matchEndStats: $('#match-end-stats'),
      scopeOverlay: $('#scope-overlay'),
      streak: $('#streak'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.mapStatic = null;
    this.hitmarkerUntil = 0;
    this.indicatorList = [];
    this.shakeAmount = 0;
    this.lastKillfeedLen = -1;
  }

  reset() {
    this.el.matchEnd.classList.add('hidden');
    this.el.killfeed.innerHTML = '';
    this.el.floaters.innerHTML = '';
    this.el.indicators.innerHTML = '';
    this.indicatorList.length = 0;
    this.lastKillfeedLen = -1;
    this.mapStatic = null;
    const dom = this.game.arena.mode.id === 'domination';
    this.el.pointsStrip.classList.toggle('hidden', !dom);
    if (dom) {
      this.el.pointsStrip.innerHTML = this.game.world.points
        .map((p) => `<div class="point" data-id="${p.id}"><span>${p.id}</span><i></i></div>`)
        .join('');
    }
  }

  // ------------------------------------------------------------- feedback

  hitmarker(headshot, lethal) {
    this.hitmarkerUntil = this.game.time + 0.12;
    this.el.hitmarkerEl.className = lethal ? 'lethal' : headshot ? 'head' : '';
    this.el.hitmarkerEl.style.opacity = '1';
  }

  damageNumber(amount, headshot) {
    const span = document.createElement('span');
    span.className = 'floater' + (headshot ? ' head' : '');
    span.textContent = Math.round(amount);
    span.style.left = `${48 + Math.random() * 6}%`;
    span.style.top = `${44 + Math.random() * 5}%`;
    this.el.floaters.appendChild(span);
    setTimeout(() => span.remove(), 800);
  }

  damageFlash(fromPos) {
    this.el.damageFlashEl.style.opacity = '0.55';
    setTimeout(() => { this.el.damageFlashEl.style.opacity = '0'; }, 120);
    this.shake(0.35);
    if (!fromPos || !this.game.player) return;

    const p = this.game.player;
    const to = fromPos.clone().sub(p.pos);
    const angle = Math.atan2(to.x, -to.z) - p.yaw;
    const el = document.createElement('div');
    el.className = 'dmg-arrow';
    el.style.transform = `rotate(${-angle}rad) translateY(-90px)`;
    this.el.indicators.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  shake(amount) {
    if (this.game.player) this.game.player.shake = Math.min(0.6, this.game.player.shake + amount);
  }

  // --------------------------------------------------------------- update

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p) return;
    const arena = g.arena;

    // health / ammo
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    this.el.health.style.width = `${hpRatio * 100}%`;
    this.el.health.style.background = hpRatio > 0.55 ? 'linear-gradient(90deg,#4ade80,#22c55e)'
      : hpRatio > 0.25 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
      : 'linear-gradient(90deg,#f87171,#ef4444)';
    this.el.healthText.textContent = Math.ceil(Math.max(0, p.hp));
    this.el.ammo.textContent = p.reloading ? '--' : p.ammo;
    this.el.ammoMag.textContent = `/ ${p.weapon.mag}`;
    this.el.weapon.textContent = p.weapon.name + (p.reloading ? ' · nachladen' : '');
    this.el.classChip.textContent = `${p.cls.icon} ${p.cls.name}`;

    // ability
    const cd = Math.max(0, p.abilityReadyAt - g.time);
    const ready = cd <= 0;
    this.el.abilityIcon.textContent = p.cls.ability.icon;
    this.el.abilityName.textContent = p.cls.ability.name;
    this.el.abilityCd.textContent = ready ? 'BEREIT' : cd.toFixed(1);
    this.el.abilityCd.parentElement.classList.toggle('ready', ready);

    // streak
    this.el.streak.textContent = p.streak >= 2 ? `${p.streak}× Serie` : '';

    // scores
    const limit = arena.mode.scoreLimit;
    const a = Math.floor(arena.scores.alpha), b = Math.floor(arena.scores.bravo);
    this.el.scoreAlpha.textContent = a;
    this.el.scoreBravo.textContent = b;
    this.el.barAlpha.style.width = `${Math.min(100, (a / limit) * 100)}%`;
    this.el.barBravo.style.width = `${Math.min(100, (b / limit) * 100)}%`;
    const t = Math.max(0, arena.timeLeft);
    this.el.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

    // capture points
    if (arena.mode.id === 'domination') {
      for (const point of g.world.points) {
        const el = this.el.pointsStrip.querySelector(`[data-id="${point.id}"]`);
        if (!el) continue;
        el.style.borderColor = point.owner ? TEAMS[point.owner].css : 'rgba(255,255,255,0.4)';
        el.style.background = point.owner ? `${TEAMS[point.owner].css}33` : 'rgba(10,14,20,0.55)';
        el.classList.toggle('contested', point.contested);
        const bar = el.querySelector('i');
        bar.style.width = `${Math.abs(point.progress) * 100}%`;
        bar.style.background = point.progress < 0 ? TEAMS.alpha.css : TEAMS.bravo.css;
      }
    }

    // killfeed
    if (arena.events.length !== this.lastKillfeedLen) {
      this.lastKillfeedLen = arena.events.length;
      this.el.killfeed.innerHTML = arena.events.slice(-6).map((e) => `
        <div class="kf">
          <span style="color:${e.killerTeam ? TEAMS[e.killerTeam].css : '#ccc'}">${e.killer}</span>
          <b>⟶</b>
          <span style="color:${TEAMS[e.victimTeam].css}">${e.victim}</span>
        </div>`).join('');
    }

    // centre notice
    const notice = arena.notices[arena.notices.length - 1];
    this.el.notice.textContent = notice ? notice.text : '';
    this.el.notice.style.opacity = notice ? '1' : '0';

    // crosshair spread + hitmarker fade
    const spread = p.currentSpread();
    const gap = 6 + spread * 3.2;
    this.el.crosshair.style.setProperty('--gap', `${gap}px`);
    this.el.crosshair.style.opacity = p.scoped ? '0' : '1';
    this.el.scopeOverlay.classList.toggle('hidden', !p.scoped);
    if (g.time > this.hitmarkerUntil) this.el.hitmarkerEl.style.opacity = '0';

    // respawn overlay
    if (!p.alive) {
      this.el.respawn.classList.remove('hidden');
      this.el.respawnTime.textContent = Math.max(0, p.respawnAt - g.time).toFixed(1);
    } else {
      this.el.respawn.classList.add('hidden');
    }

    this.drawMinimap();
  }

  setKillerInfo(text) {
    this.el.killerInfo.textContent = text;
  }

  // -------------------------------------------------------------- minimap

  buildStaticMap() {
    const size = 200;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    ctx.fillRect(0, 0, size, size);

    const scale = size / 116;
    ctx.fillStyle = 'rgba(220,200,160,0.35)';
    for (const box of this.game.world.colliders) {
      const w = (box.max.x - box.min.x) * scale;
      const d = (box.max.z - box.min.z) * scale;
      if (w * d < 4) continue;
      const x = (box.min.x + 58) * scale;
      const y = (box.min.z + 58) * scale;
      const height = box.max.y - box.min.y;
      ctx.globalAlpha = Math.min(0.55, 0.16 + height * 0.05);
      ctx.fillRect(x, y, w, d);
    }
    ctx.globalAlpha = 1;
    this.mapStatic = c;
  }

  drawMinimap() {
    if (!this.mapStatic) this.buildStaticMap();
    const ctx = this.mapCtx;
    const size = this.el.minimap.width;
    const scale = size / 116;
    const g = this.game;
    const p = g.player;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.mapStatic, 0, 0, size, size);

    const toMap = (v) => ({ x: (v.x + 58) * scale, y: (v.z + 58) * scale });

    // capture points
    if (g.arena.mode.id === 'domination') {
      for (const point of g.world.points) {
        const m = toMap(point.pos);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = point.owner ? TEAMS[point.owner].css : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(point.id, m.x, m.y + 3);
      }
    }

    // fighters
    for (const f of g.fighters) {
      if (!f.alive || f === p) continue;
      const ally = f.team === p.team;
      if (!ally) {
        const known = f.marked > g.time ||
          (f.pos.distanceTo(p.pos) < 38 && g.world.lineOfSight(p.eye, f.pos.clone().setY(f.pos.y + 1.2)));
        if (!known || f.cloaked) continue;
      }
      const m = toMap(f.pos);
      ctx.fillStyle = TEAMS[f.team].css;
      ctx.beginPath();
      ctx.arc(m.x, m.y, ally ? 3 : 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // player arrow
    const me = toMap(p.pos);
    ctx.save();
    ctx.translate(me.x, me.y);
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------ scoreboard

  renderScoreboard() {
    const g = this.game;
    const rows = (team) => g.fighters
      .filter((f) => f.team === team)
      .sort((x, y) => y.score - x.score || y.kills - x.kills)
      .map((f) => `
        <tr class="${f === g.player ? 'me' : ''}">
          <td>${f.cls.icon}</td>
          <td class="nm">${f.name}${f === g.player ? ' <i>(du)</i>' : ''}</td>
          <td>${f.kills}</td>
          <td>${f.deaths}</td>
          <td>${f.assists}</td>
          <td>${f.score}</td>
        </tr>`).join('');

    const head = `<tr><th></th><th>Name</th><th>K</th><th>T</th><th>A</th><th>Punkte</th></tr>`;
    this.el.scoreboard.innerHTML = ['alpha', 'bravo'].map((team) => `
      <div class="sb-team" style="--team:${TEAMS[team].css}">
        <h3>${TEAMS[team].name} <span>${Math.floor(g.arena.scores[team])}</span></h3>
        <table>${head}${rows(team)}</table>
      </div>`).join('');
  }

  setScoreboardVisible(visible) {
    if (visible) this.renderScoreboard();
    this.el.scoreboard.classList.toggle('hidden', !visible);
  }

  showMatchEnd(winner, playerWon) {
    this.renderScoreboard();
    this.el.matchEnd.classList.remove('hidden');
    this.el.matchEndTitle.textContent = playerWon ? 'SIEG' : 'NIEDERLAGE';
    this.el.matchEndTitle.style.color = playerWon ? '#4ade80' : '#f87171';
    this.el.matchEndSub.textContent = `${TEAMS[winner].name} gewinnt ${Math.floor(this.game.arena.scores[winner])} : ${Math.floor(this.game.arena.scores[winner === 'alpha' ? 'bravo' : 'alpha'])}`;
    const p = this.game.player;
    this.el.matchEndStats.innerHTML = `
      <div><b>${p.kills}</b><span>Abschüsse</span></div>
      <div><b>${p.deaths}</b><span>Tode</span></div>
      <div><b>${p.assists}</b><span>Assists</span></div>
      <div><b>${p.score}</b><span>Punkte</span></div>
      <div><b>${(p.kills / Math.max(1, p.deaths)).toFixed(2)}</b><span>K/D</span></div>`;
  }
}

export { THREE, MODES };
