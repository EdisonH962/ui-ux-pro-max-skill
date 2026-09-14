// The local player: first person camera, weapon viewmodel, recoil and input.

import * as THREE from 'three';
import { Fighter } from './entities.js';
import { PHYSICS } from './config.js';

function buildViewmodel(classId, teamColor) {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x343b45 });
  const accent = new THREE.MeshLambertMaterial({ color: teamColor });
  const hand = new THREE.MeshLambertMaterial({ color: 0xd9a271 });

  const add = (w, h, d, x, y, z, m = dark) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  switch (classId) {
    case 'sniper':
      add(0.07, 0.09, 1.5, 0, 0, -0.55);
      add(0.06, 0.12, 0.3, 0, 0.1, -0.5);
      add(0.1, 0.2, 0.26, 0, -0.1, -0.05, accent);
      break;
    case 'gunner':
      add(0.16, 0.16, 0.9, 0, 0, -0.5);
      add(0.24, 0.24, 0.22, 0, 0, -0.18, accent);
      add(0.1, 0.22, 0.24, 0, -0.14, 0.02);
      break;
    case 'stealth':
      add(0.12, 0.12, 0.75, 0, 0, -0.42);
      add(0.09, 0.2, 0.22, 0, -0.11, -0.02, accent);
      break;
    case 'medic':
      add(0.09, 0.14, 0.5, 0, 0, -0.35);
      add(0.1, 0.18, 0.2, 0, -0.1, -0.02, accent);
      break;
    default:
      add(0.1, 0.13, 0.85, 0, 0, -0.45);
      add(0.09, 0.2, 0.22, 0, -0.11, -0.05, accent);
      add(0.08, 0.1, 0.24, 0, 0.08, -0.25);
  }
  add(0.1, 0.1, 0.14, 0.02, -0.16, -0.12, hand);

  // the viewmodel sits very close to a wide-FOV camera, so it is scaled down
  // hard to read like a held weapon instead of a wall of boxes
  g.position.set(0.3, -0.24, -0.62);
  g.rotation.y = 0.07;
  g.scale.setScalar(0.45);
  return g;
}

export class Player extends Fighter {
  constructor(game, opts) {
    super(game, { ...opts, isPlayer: true });
    this.scoped = false;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.bob = 0;
    this.shake = 0;
    this.semiLatch = false;
    this.viewmodel = buildViewmodel(this.cls.id, 0x9fb1c6);
    this.vmKick = 0;
    this.vmOffset = new THREE.Vector3();
    game.camera.add(this.viewmodel);
    this.baseFov = 78;
  }

  destroy() {
    this.game.camera.remove(this.viewmodel);
    this.game.scene.remove(this.mesh);
  }

  update(dt) {
    const input = this.game.input;
    const cam = this.game.camera;

    // ---- look
    const look = input.consumeLook();
    const sens = input.sensitivity * (this.scoped ? 0.45 : 1);
    this.yaw -= look.dx * sens;
    this.pitch -= look.dy * sens * (input.invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);

    // recoil recovers towards zero, the leftover is added to the aim
    const recover = Math.min(1, dt * 7);
    this.pitch -= this.recoilPitch * 0.0;
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, recover);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, recover);

    if (this.alive) {
      this.handleMovement(dt, input);
      this.handleWeapons(dt, input);
      this.updateAbility(dt);
      this.regenerate(dt);
      this.updateReload();
    } else {
      this.vel.set(0, 0, 0);
    }

    this.moveAndCollide(dt);
    this.syncMesh(dt);
    this.updateCamera(dt, cam);
  }

  handleMovement(dt, input) {
    const mv = input.moveVector();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(forward, mv.y)
      .addScaledVector(right, mv.x);
    if (wish.lengthSq() > 0) wish.normalize();

    const sprinting = input.down('sprint') && mv.y > 0.2 && !this.scoped;
    this.sprinting = sprinting;
    this.applyMoveInput(wish, dt, sprinting ? PHYSICS.sprintMul : (this.scoped ? 0.55 : 1));

    if (input.down('jump')) this.jump();

    const speed = new THREE.Vector3(this.vel.x, 0, this.vel.z).length();
    this.bob += speed * dt * 1.6;
    if (speed > 2 && this.onGround) {
      const phase = Math.sin(this.bob * 2);
      if (this._stepSign !== undefined && Math.sign(phase) !== this._stepSign) this.game.audio.step(0);
      this._stepSign = Math.sign(phase);
    }
  }

  handleWeapons(dt, input) {
    const w = this.weapon;

    if (input.press('reload')) this.startReload();
    if (input.press('ability')) this.useAbility();

    // sniper scope
    const wantScope = input.mouse.right && this.cls.id === 'sniper';
    this.scoped = wantScope && this.alive;

    if (input.firing()) {
      if (w.auto || !this.semiLatch) {
        if (this.canFire()) {
          this.fire();
          this.semiLatch = true;
        } else if (this.ammo <= 0 && !this.reloading) {
          this.game.audio.empty();
          this.startReload();
          this.semiLatch = true;
        }
      }
      if (this.cloaked) {   // firing breaks stealth
        this.cloaked = false;
        this.abilityUntil = 0;
        this.setOpacity(1);
      }
    } else {
      this.semiLatch = false;
    }
  }

  onFired() {
    const w = this.weapon;
    this.recoilPitch += THREE.MathUtils.degToRad(w.recoil);
    this.pitch = THREE.MathUtils.clamp(this.pitch + THREE.MathUtils.degToRad(w.recoil) * 0.55, -1.45, 1.45);
    this.yaw += (Math.random() - 0.5) * THREE.MathUtils.degToRad(w.recoil) * 0.35;
    this.vmKick = Math.min(0.32, this.vmKick + w.recoil * 0.035 + 0.05);
    this.shake = Math.min(0.5, this.shake + w.recoil * 0.012 + 0.02);
  }

  updateCamera(dt, cam) {
    const eye = this.eye;
    const speed = new THREE.Vector3(this.vel.x, 0, this.vel.z).length();

    let bobX = 0, bobY = 0;
    if (this.alive && this.onGround) {
      const amp = Math.min(0.06, speed * 0.008) * (this.scoped ? 0.2 : 1);
      bobX = Math.cos(this.bob) * amp;
      bobY = Math.abs(Math.sin(this.bob * 2)) * amp * 0.8;
    }

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake;
    const shakeX = (Math.random() - 0.5) * sh * 0.12;
    const shakeY = (Math.random() - 0.5) * sh * 0.12;

    const deathDrop = this.alive ? 0 : -0.75;

    cam.position.set(eye.x + bobX + shakeX, eye.y + bobY + shakeY + deathDrop, eye.z);
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + this.recoilYaw;
    cam.rotation.x = this.pitch + (this.alive ? 0 : -0.5);
    cam.rotation.z = THREE.MathUtils.lerp(cam.rotation.z, this.alive ? 0 : 0.5, dt * 3);

    const targetFov = this.scoped ? 26 : (this.sprinting ? this.baseFov + 6 : this.baseFov);
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, dt * 12));
      cam.updateProjectionMatrix();
    }

    // viewmodel: sway opposite to the look movement, recoil kick, hide when scoped
    this.vmKick = THREE.MathUtils.lerp(this.vmKick, 0, Math.min(1, dt * 9));
    const swayTarget = new THREE.Vector3(
      THREE.MathUtils.clamp(-this.recoilYaw * 2, -0.05, 0.05),
      THREE.MathUtils.clamp(-this.recoilPitch * 0.5, -0.05, 0.05) + Math.sin(this.bob * 2) * 0.012,
      this.vmKick
    );
    this.vmOffset.lerp(swayTarget, Math.min(1, dt * 10));
    this.viewmodel.position.set(0.3 + this.vmOffset.x, -0.24 + this.vmOffset.y, -0.62 + this.vmOffset.z);
    this.viewmodel.rotation.x = -this.vmKick * 1.2;
    this.viewmodel.visible = this.alive && !this.scoped;
  }
}
