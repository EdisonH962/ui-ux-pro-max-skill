// Loading and driving real character models (GLB) with skeletal animation.
//
// The asset pipeline this is built for hands us one animated GLB per clip — a base
// model plus separate files for idle, run, fire and so on — so the loader merges the
// clips of several files onto one skeleton and exposes them as named states.
// Everything is optional: without a manifest the game keeps its procedural fighters.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const DEFAULT_STATES = ['idle', 'run', 'aim', 'fire', 'reload', 'death'];

export class CharacterLibrary {
  constructor() {
    this.entries = new Map();     // classId -> { scene, clips: Map<state, AnimationClip>, config }
    this.loaded = false;
    this.errors = [];
  }

  has(classId) {
    return this.entries.has(classId);
  }

  /**
   * Reads `assets/models/manifest.json`. Missing file, missing entry or a broken model
   * is not an error for the game — the class simply keeps its procedural mesh.
   */
  async load(base = 'assets/', manifestPath = 'models/manifest.json') {
    let manifest;
    try {
      const res = await fetch(`${base}${manifestPath}`, { cache: 'no-cache' });
      if (!res.ok) return false;
      manifest = await res.json();
    } catch {
      return false;
    }

    const loader = new GLTFLoader();
    const characters = manifest.characters || {};
    const fileCache = new Map();

    const loadFile = (file) => {
      if (!fileCache.has(file)) {
        fileCache.set(file, loader.loadAsync(`${base}${file}`).catch((err) => {
          this.errors.push(`${file}: ${err.message}`);
          return null;
        }));
      }
      return fileCache.get(file);
    };

    await Promise.all(Object.entries(characters).map(async ([classId, config]) => {
      const gltf = await loadFile(config.model);
      if (!gltf) return;

      const clips = new Map();
      // clips that already live inside the base model
      for (const clip of gltf.animations || []) clips.set(clip.name.toLowerCase(), clip);

      const wanted = config.clips || {};
      await Promise.all(Object.entries(wanted).map(async ([state, spec]) => {
        const entry = typeof spec === 'string' ? { file: spec } : spec;
        let clip = null;
        if (entry.file) {
          const anim = await loadFile(entry.file);
          if (anim && anim.animations && anim.animations.length) {
            clip = entry.name
              ? THREE.AnimationClip.findByName(anim.animations, entry.name) || anim.animations[0]
              : anim.animations[0];
          }
        } else if (entry.name) {
          clip = THREE.AnimationClip.findByName(gltf.animations || [], entry.name);
        }
        if (!clip) { this.errors.push(`${classId}/${state}: clip not found`); return; }
        clip = clip.clone();
        clip.name = state;
        clips.set(state, { clip, loop: entry.loop || 'repeat', speed: entry.speed || 1 });
      }));

      // normalise any in-model clips that were not named by the manifest
      for (const [key, value] of clips) {
        if (value instanceof THREE.AnimationClip) clips.set(key, { clip: value, loop: 'repeat', speed: 1 });
      }

      this.entries.set(classId, { scene: gltf.scene, clips, config });
    }));

    this.loaded = true;
    return this.entries.size > 0;
  }

  /** One independent, animatable instance of a class model. */
  create(classId, teamColor) {
    const entry = this.entries.get(classId);
    if (!entry) return null;
    return new Character(entry, teamColor);
  }
}

export class Character {
  constructor(entry, teamColor) {
    const { scene, clips, config } = entry;
    this.config = config;

    this.root = new THREE.Group();
    this.model = cloneSkinned(scene);          // clones skinned meshes with their skeleton
    const scale = config.scale || 1;
    this.model.scale.setScalar(scale);
    this.model.position.y = config.yOffset || 0;
    this.model.rotation.y = config.rotationY || 0;
    this.root.add(this.model);

    this.materials = [];
    this.model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;                 // skinned bounds go stale while animating
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = Array.isArray(o.material) ? mats.map((m) => m.clone()) : mats[0].clone();
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.envMapIntensity = 0.35;
        this.materials.push(m);
        if (config.teamMaterial && m.name === config.teamMaterial) {
          m.color = new THREE.Color(teamColor);
        }
      }
    });

    // team tint: a light multiply so friend/foe stays readable at distance
    if (!config.teamMaterial) {
      const tint = new THREE.Color(teamColor);
      for (const m of this.materials) {
        if (!m.color) continue;
        m.color.lerp(tint, config.teamTint ?? 0.35);
      }
    }

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map();
    for (const [state, value] of clips) {
      const action = this.mixer.clipAction(value.clip);
      if (value.loop === 'once') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.timeScale = value.speed || 1;
      this.actions.set(state, action);
    }

    this.current = null;
    this.oneShotUntil = 0;
    this.play('idle', 0);

    if (config.weaponBone) {
      this.weaponMount = new THREE.Object3D();
      const bone = this.model.getObjectByName(config.weaponBone);
      (bone || this.model).add(this.weaponMount);
    }
  }

  /** Cross-fades into a state; unknown states fall back to idle. */
  play(state, fade = 0.18) {
    let action = this.actions.get(state);
    if (!action) action = this.actions.get('idle');
    if (!action || action === this.current) return;
    if (this.current) this.current.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    this.current = action;
    this.currentState = state;
  }

  /** Plays a one-shot (fire, reload) and returns to the locomotion state afterwards. */
  trigger(state, time, duration = 0.45) {
    if (!this.actions.has(state)) return;
    this.play(state, 0.06);
    this.oneShotUntil = time + duration;
  }

  /**
   * Chooses the animation from what the fighter is actually doing. Kept here so the
   * fighter code stays free of animation bookkeeping.
   */
  drive(state, time) {
    if (time < this.oneShotUntil) return;
    this.play(state);
  }

  update(dt) {
    this.mixer.update(dt);
  }

  setOpacity(o) {
    const visible = o >= 0.99;
    for (const m of this.materials) {
      m.transparent = !visible;
      m.opacity = o;
      m.depthWrite = visible;
      m.needsUpdate = true;
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

export { DEFAULT_STATES };
