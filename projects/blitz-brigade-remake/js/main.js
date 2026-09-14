// Bootstrap: renderer, menu, match setup and the main loop.

import * as THREE from 'three';
import { CLASSES, CLASS_LIST, MODES, DIFFICULTY, TEAMS, BOT_NAMES, RULES } from './config.js';
import { World } from './world.js';
import { Arena } from './arena.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Bot } from './bots.js';

const $ = (sel) => document.querySelector(sel);

class Game {
  constructor() {
    this.canvas = $('#view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 500);
    this.scene.add(this.camera);

    this.time = 0;
    this.running = false;
    this.paused = false;
    this.fighters = [];
    this.player = null;
    this.difficulty = DIFFICULTY.veteran;

    this.world = new World(this.scene).build();
    this.fx = new FX(this.scene);
    this.audio = new AudioEngine();
    this.arena = new Arena(this);
    this.hud = new HUD(this);
    this.input = new Input(this.canvas);
    this.input.setupTouch(document.body);

    this.settings = {
      sensitivity: 2.2,
      volume: 55,
      shadows: true,
    };

    this.setupMenu();
    this.setupEvents();
    this.orbitMenuCamera();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ----------------------------------------------------------------- menu

  setupMenu() {
    this.selected = { cls: 'soldier', mode: 'tdm', size: 6, diff: 'veteran' };

    const classGrid = $('#class-grid');
    classGrid.innerHTML = CLASS_LIST.map((c) => `
      <button class="card class-card${c.id === 'soldier' ? ' active' : ''}" data-cls="${c.id}">
        <span class="ic">${c.icon}</span>
        <strong>${c.name}</strong>
        <em>${c.tagline}</em>
        <div class="stats">
          <span>❤ ${c.hp}</span><span>🏃 ${c.speed.toFixed(1)}</span><span>🔫 ${c.weapon.name}</span>
        </div>
        <div class="ability">${c.ability.icon} ${c.ability.name}</div>
      </button>`).join('');

    classGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cls]');
      if (!btn) return;
      this.selected.cls = btn.dataset.cls;
      classGrid.querySelectorAll('.class-card').forEach((el) => el.classList.toggle('active', el === btn));
    });

    const wire = (sel, key) => {
      const root = $(sel);
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-value]');
        if (!btn) return;
        this.selected[key] = isNaN(+btn.dataset.value) ? btn.dataset.value : +btn.dataset.value;
        root.querySelectorAll('[data-value]').forEach((el) => el.classList.toggle('active', el === btn));
      });
    };
    wire('#mode-select', 'mode');
    wire('#size-select', 'size');
    wire('#diff-select', 'diff');

    $('#start-btn').addEventListener('click', () => this.startMatch());
    $('#resume-btn').addEventListener('click', () => this.resume());
    $('#quit-btn').addEventListener('click', () => this.toMenu());
    $('#rematch-btn').addEventListener('click', () => this.startMatch());
    $('#menu-btn').addEventListener('click', () => this.toMenu());

    const sens = $('#sens-slider');
    const vol = $('#vol-slider');
    sens.addEventListener('input', () => {
      this.settings.sensitivity = +sens.value;
      this.input.sensitivity = +sens.value * 0.001;
      $('#sens-value').textContent = (+sens.value).toFixed(1);
    });
    vol.addEventListener('input', () => {
      this.settings.volume = +vol.value;
      this.audio.setVolume(+vol.value / 100);
      $('#vol-value').textContent = vol.value;
    });
    this.input.sensitivity = this.settings.sensitivity * 0.001;

    // respawn screen: pick a different class for the next life
    const respawnClasses = $('#respawn-classes');
    respawnClasses.innerHTML = CLASS_LIST.map((c, i) => `
      <button class="mini-class" data-cls="${c.id}" title="${c.name}">
        <b>${i + 1}</b>${c.icon}<span>${c.name}</span>
      </button>`).join('');
    respawnClasses.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cls]');
      if (!btn) return;
      this.pendingClass = btn.dataset.cls;
      respawnClasses.querySelectorAll('.mini-class').forEach((el) => el.classList.toggle('active', el === btn));
    });
  }

  setupEvents() {
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });

    this.input.onKey = (code, down) => {
      if (!this.running) return;
      if (code === 'Tab') this.hud.setScoreboardVisible(down);
      if (code === 'Escape' && down) this.pause();
      // while dead, 1-5 queue the class for the next life (works with the mouse locked)
      if (down && this.player && !this.player.alive && /^Digit[1-5]$/.test(code)) {
        const idx = +code.slice(5) - 1;
        const cls = CLASS_LIST[idx];
        if (cls) {
          this.pendingClass = cls.id;
          document.querySelectorAll('#respawn-classes .mini-class').forEach((el) =>
            el.classList.toggle('active', el.dataset.cls === cls.id));
        }
      }
    };
    this.input.onLockChange = (locked) => {
      if (!locked && this.running && !this.arena.matchOver && !this.input.touch.enabled) this.pause();
    };
    this.canvas.addEventListener('click', () => {
      if (this.running && this.paused) return;
      if (this.running) this.input.requestLock();
    });
  }

  orbitMenuCamera() {
    this.menuCam = { angle: 0 };
    this.camera.position.set(0, 14, 40);
    this.camera.lookAt(0, 6, 0);
  }

  // ---------------------------------------------------------------- match

  clearFighters() {
    for (const f of this.fighters) {
      this.scene.remove(f.mesh);
      if (f.destroy) f.destroy();
    }
    this.fighters.length = 0;
    this.player = null;
  }

  startMatch() {
    this.audio.init();
    this.audio.setVolume(this.settings.volume / 100);
    this.clearFighters();

    const mode = MODES[this.selected.mode];
    this.difficulty = DIFFICULTY[this.selected.diff];
    this.arena.reset(mode);

    const perTeam = this.selected.size;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const classIds = Object.keys(CLASSES);

    this.player = new Player(this, {
      team: 'alpha',
      cls: CLASSES[this.selected.cls],
      name: 'Du',
    });
    this.fighters.push(this.player);

    for (const team of ['alpha', 'bravo']) {
      const count = team === 'alpha' ? perTeam - 1 : perTeam;
      for (let i = 0; i < count; i++) {
        const cls = CLASSES[classIds[(i + (team === 'alpha' ? 1 : 3)) % classIds.length]];
        const bot = new Bot(this, { team, cls, name: names.pop() || `Bot ${i}` });
        this.fighters.push(bot);
      }
    }

    for (const f of this.fighters) f.spawn(this.arena.respawnPosition(f.team));

    this.hud.reset();
    this.hud.el.root.classList.remove('hidden');
    $('#menu').classList.add('hidden');
    $('#pause').classList.add('hidden');
    $('#match-end').classList.add('hidden');
    this.hud.setScoreboardVisible(false);

    this.running = true;
    this.paused = false;
    this.pendingClass = null;
    this.input.requestLock();
  }

  pause() {
    if (!this.running || this.paused || this.arena.matchOver) return;
    this.paused = true;
    this.input.releaseLock();
    $('#pause').classList.remove('hidden');
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    $('#pause').classList.add('hidden');
    this.input.requestLock();
  }

  toMenu() {
    this.running = false;
    this.paused = false;
    this.input.releaseLock();
    this.clearFighters();
    $('#pause').classList.add('hidden');
    $('#match-end').classList.add('hidden');
    $('#menu').classList.remove('hidden');
    this.hud.el.root.classList.add('hidden');
    this.hud.setScoreboardVisible(false);
    this.orbitMenuCamera();
  }

  handleRespawns() {
    for (const f of this.fighters) {
      if (f.alive || this.time < f.respawnAt) continue;
      if (f === this.player) {
        if (this.pendingClass && this.pendingClass !== f.cls.id) {
          const newCls = CLASSES[this.pendingClass];
          const stats = { kills: f.kills, deaths: f.deaths, assists: f.assists, score: f.score };
          f.destroy();
          const idx = this.fighters.indexOf(f);
          const fresh = new Player(this, { team: f.team, cls: newCls, name: f.name });
          Object.assign(fresh, stats);
          this.fighters[idx] = fresh;
          this.player = fresh;
          this.pendingClass = null;
          fresh.spawn(this.arena.respawnPosition(fresh.team));
          continue;
        }
      }
      f.spawn(this.arena.respawnPosition(f.team));
    }
  }

  // ----------------------------------------------------------------- loop

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());

    if (!this.running) {
      // slow orbit over the map behind the menu
      this.menuCam.angle += dt * 0.06;
      const r = 52;
      this.camera.position.set(Math.sin(this.menuCam.angle) * r, 20, Math.cos(this.menuCam.angle) * r);
      this.camera.lookAt(0, 6, 0);
      this.fx.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.paused) {
      this.time += dt;
      this.player.update(dt);
      for (const f of this.fighters) if (f !== this.player) f.update(dt);
      this.arena.update(dt);
      this.handleRespawns();
      this.fx.update(dt);
      this.hud.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new Game();
    document.body.classList.add('ready');
  } catch (err) {
    console.error(err);
    const el = document.querySelector('#boot-error');
    if (el) {
      el.classList.remove('hidden');
      el.textContent = 'Fehler beim Start: ' + err.message;
    }
  }
});

export { Game, RULES, TEAMS };
