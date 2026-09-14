// Balance & content definitions for the Blitz Brigade fan remake.
// Everything the designer wants to tweak lives here.

export const TEAMS = {
  alpha: { id: 'alpha', name: 'Ember Company', color: 0xff5a3c, css: '#ff5a3c', light: '#ffb199' },
  bravo: { id: 'bravo', name: 'Azure Vanguard', color: 0x38b6ff, css: '#38b6ff', light: '#a8e0ff' },
};

export const ENEMY_OF = { alpha: 'bravo', bravo: 'alpha' };

// rpm -> seconds between shots
const rate = (rpm) => 60 / rpm;

export const CLASSES = {
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    tagline: 'Allrounder mit Sturmgewehr und Splittergranate.',
    hp: 110,
    speed: 6.4,
    jump: 8.4,
    icon: '🎖️',
    weapon: {
      name: 'MK-7 Assault',
      damage: 21,
      headshot: 2.0,
      interval: rate(620),
      mag: 30,
      reload: 2.0,
      spread: 0.9,        // degrees, standing still
      moveSpread: 2.6,
      recoil: 0.85,
      range: 70,
      falloffStart: 28,
      falloffMin: 0.55,
      pellets: 1,
      auto: true,
      sound: 'rifle',
    },
    ability: { id: 'grenade', name: 'Splittergranate', cooldown: 11, icon: '💣' },
  },
  gunner: {
    id: 'gunner',
    name: 'Gunner',
    tagline: 'Wandelnder Bunker: MG mit Anlauf, dickes Lebenspolster.',
    hp: 165,
    speed: 5.2,
    jump: 7.6,
    icon: '🛡️',
    weapon: {
      name: 'Vulcan HMG',
      damage: 15,
      headshot: 1.6,
      interval: rate(900),
      mag: 80,
      reload: 4.2,
      spread: 2.4,
      moveSpread: 4.0,
      recoil: 0.5,
      range: 55,
      falloffStart: 20,
      falloffMin: 0.45,
      pellets: 1,
      auto: true,
      spinUp: 0.35,
      sound: 'hmg',
    },
    ability: { id: 'bulwark', name: 'Bollwerk', cooldown: 20, duration: 6, icon: '🧱' },
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    tagline: 'Heilimpuls für das Team, schnelle MP für den Nahkampf.',
    hp: 105,
    speed: 6.8,
    jump: 8.6,
    icon: '➕',
    weapon: {
      name: 'Vector SMG',
      damage: 13,
      headshot: 1.8,
      interval: rate(880),
      mag: 34,
      reload: 1.8,
      spread: 1.6,
      moveSpread: 3.0,
      recoil: 0.6,
      range: 42,
      falloffStart: 16,
      falloffMin: 0.45,
      pellets: 1,
      auto: true,
      sound: 'smg',
    },
    ability: { id: 'heal', name: 'Heilimpuls', cooldown: 13, duration: 4, radius: 9, healPerSec: 22, icon: '💚' },
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    tagline: 'Ein Schuss, eine Lücke in der feindlichen Linie.',
    hp: 90,
    speed: 6.2,
    jump: 8.4,
    icon: '🎯',
    weapon: {
      name: 'Longshot R7',
      damage: 82,
      headshot: 2.2,
      interval: rate(48),
      mag: 5,
      reload: 3.0,
      spread: 2.8,
      scopedSpread: 0.05,
      moveSpread: 6.0,
      recoil: 3.2,
      range: 220,
      falloffStart: 220,
      falloffMin: 1,
      pellets: 1,
      auto: false,
      sound: 'sniper',
    },
    ability: { id: 'recon', name: 'Aufklärer-Puls', cooldown: 17, duration: 7, icon: '📡' },
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth',
    tagline: 'Tarnkappe rein, Schrotflinte raus, Ziel weg.',
    hp: 95,
    speed: 7.4,
    jump: 9.2,
    icon: '🌫️',
    weapon: {
      name: 'Breacher SG',
      damage: 12,
      headshot: 1.5,
      interval: rate(95),
      mag: 6,
      reload: 2.6,
      spread: 4.6,
      moveSpread: 5.4,
      recoil: 2.4,
      range: 26,
      falloffStart: 8,
      falloffMin: 0.18,
      pellets: 9,
      auto: false,
      sound: 'shotgun',
    },
    ability: { id: 'cloak', name: 'Tarnfeld', cooldown: 15, duration: 6, speedBonus: 1.3, icon: '👻' },
  },
};

export const CLASS_LIST = Object.values(CLASSES);

export const MODES = {
  tdm: {
    id: 'tdm',
    name: 'Team Deathmatch',
    blurb: 'Erste Brigade mit 50 Abschüssen gewinnt.',
    scoreLimit: 50,
    timeLimit: 8 * 60,
  },
  domination: {
    id: 'domination',
    name: 'Domination',
    blurb: 'Drei Punkte halten, Tickets sammeln, 500 zuerst erreichen.',
    scoreLimit: 500,
    timeLimit: 10 * 60,
    tickRate: 1.6,  // score per second per owned point
    captureSpeed: 0.34,
    captureRadius: 6.5,
  },
};

export const DIFFICULTY = {
  rookie:  { id: 'rookie',  name: 'Rekrut',   aimError: 5.5, reaction: 0.55, burst: [0.35, 0.8], accuracyFalloff: 1.6, hpScale: 0.85 },
  veteran: { id: 'veteran', name: 'Veteran',  aimError: 2.8, reaction: 0.32, burst: [0.5, 1.2],  accuracyFalloff: 1.1, hpScale: 1.0 },
  elite:   { id: 'elite',   name: 'Elite',    aimError: 1.3, reaction: 0.18, burst: [0.8, 1.8],  accuracyFalloff: 0.8, hpScale: 1.15 },
};

export const PHYSICS = {
  gravity: 24,
  playerRadius: 0.42,
  playerHeight: 1.82,
  eyeHeight: 1.62,
  stepHeight: 0.62,
  accel: 62,
  airAccel: 14,
  friction: 11,
  sprintMul: 1.32,
  maxFall: -48,
};

export const RULES = {
  respawnDelay: 4.5,
  spawnProtection: 1.0,
  regenDelay: 6,
  regenRate: 12,
  grenade: { fuse: 2.2, damage: 120, radius: 7.5, speed: 20 },
  killScore: 100,
  assistScore: 40,
  captureScore: 150,
};

export const BOT_NAMES = [
  'Ramirez', 'Volkov', 'Nakamura', 'Okoye', 'Lindqvist', 'Dubois', 'Castellano', 'Reyes',
  'Hargreaves', 'Bekker', 'Ivanova', 'Kowalski', 'Santoro', 'Ferreira', 'Mbeki', 'Novak',
  'Karlsson', 'Delgado', 'Fontaine', 'Sokolov', 'Habib', 'Mendoza', 'Brennan', 'Yilmaz',
];
