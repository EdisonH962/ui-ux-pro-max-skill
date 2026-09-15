// Bootstrap: renderer, menu, match setup and the main loop.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CLASSES, CLASS_LIST, MODES, DIFFICULTY, TEAMS, BOT_NAMES, RULES } from './config.js';
import { MaterialLibrary } from './materials.js';
import { CharacterLibrary } from './characters.js';
import { World } from './world.js';
import { Arena } from './arena.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Bot } from './bots.js';

const $ = (sel) => document.querySelector(sel);

/** Subtle vignette and warm grade — keeps the eye on the centre of the screen. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.38 },
    warmth: { value: 0.04 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float warmth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.85, 0.28, d);
      texel.rgb *= mix(1.0 - strength, 1.0, vig);
      texel.r *= 1.0 + warmth;
      texel.b *= 1.0 - warmth * 0.6;
      gl_FragColor = texel;
    }`,
};

class Game {
  constructor() {
    this.canvas = $('#view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 500);
    this.scene.add(this.camera);

    this.time = 0;
    this.running = false;
    this.paused = false;
    this.fighters = [];
    this.player = null;
    this.difficulty = DIFFICULTY.veteran;

    // neutral studio IBL so metals and glossy surfaces have something to reflect
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.materials = new MaterialLibrary(this.renderer);
    this.characters = new CharacterLibrary();
    // character models are optional; the match simply starts with procedural fighters
    // if none are shipped, and waits for the load if they are
    this.charactersReady = this.characters.load().then((ok) => {
      if (this.characters.errors.length) console.warn('character assets:', this.characters.errors);
      return ok;
    });
    this.world = new World(this.scene, this.materials).build();
    // phones start on the low tier; desktops on medium, switchable in the menu
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.applyQuality(coarse ? 'low' : 'medium');
    // real textures, if the project ships any, replace the procedural ones here
    this.materials.loadManifest();
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

  /**
   * Quality tiers. Post-processing and MSAA are the expensive part of this pipeline,
   * so the low tier drops the composer entirely and renders straight to the canvas —
   * that is the difference between playable and slideshow on weak mobile GPUs.
   */
  applyQuality(level) {
    this.quality = level;
    const preset = {
      // shadows and image-based lighting cost far more than the post chain does,
      // so the low tier drops both and renders below native resolution
      low:    { samples: 0, bloom: false, composer: false, shadow: 0, pixelRatio: 0.75, env: 0 },
      medium: { samples: 0, bloom: true, composer: true, shadow: 1024, pixelRatio: 1, env: 0.35 },
      high:   { samples: 4, bloom: true, composer: true, shadow: 2048, pixelRatio: 2, env: 0.35 },
    }[level] || {};

    this.renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatio));
    this.scene.environment = preset.env > 0 ? this.envMap : null;
    this.scene.environmentIntensity = preset.env;

    const sun = this.world.sun;
    this.renderer.shadowMap.enabled = preset.shadow > 0;
    if (sun) {
      sun.castShadow = preset.shadow > 0;
      if (preset.shadow > 0 && sun.shadow.mapSize.width !== preset.shadow) {
        sun.shadow.mapSize.set(preset.shadow, preset.shadow);
      }
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.isMesh && o.material) o.material.needsUpdate = true; });

    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer = null;
      this.bloom = null;
    }
    if (!preset.composer) return;

    const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
      samples: preset.samples,          // MSAA inside the composer chain
      type: THREE.HalfFloatType,        // keep highlights linear for the bloom pass
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (preset.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.6, 1.0);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());   // tone mapping + colour space happen here
    this.composer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatio));
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  setupMenu() {
    this.selected = { cls: 'soldier', mode: 'tdm', size: 6, diff: 'veteran', quality: null };

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
    wire('#quality-select', 'quality');
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
      if (this.composer) this.composer.setSize(innerWidth, innerHeight);
      if (this.bloom) this.bloom.setSize(innerWidth, innerHeight);
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

  async startMatch() {
    await this.charactersReady;
    if (this.selected.quality && this.selected.quality !== this.quality) {
      this.applyQuality(this.selected.quality);
    }
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

    this.fx.clearDecals();
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
      this.render();
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

    this.render();
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
