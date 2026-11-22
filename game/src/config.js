// The fixed numbers behind "Velvet Vault": one room, one frame, one night.
// Every value the rules, the world and the renderer share lives here, so tuning
// the game means editing this file and nothing else.
export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;

// The gallery floor, inside the outer walls.
export const ROOM = { x: 48, y: 92, width: 1184, height: 596 };
export const WALL = 16;

export const THIEF = {
  radius: 14,
  speed: 185,
  // A thief seen for less than this long is only suspicion, never a catch.
  graceSeconds: 0.45,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 72,
  alertSpeed: 128,
  visionRange: 250,
  visionHalfAngle: Math.PI / 5.2, // about 35 degrees each side
  // How long a guard keeps hunting the last place it saw the thief.
  huntSeconds: 4,
};

export const CAMERA = {
  visionRange: 300,
  visionHalfAngle: Math.PI / 6, // 30 degrees each side
  sweepSpeed: 0.55, // radians per second
};

export const ALARM = {
  risePerSecondInGuardCone: 30,
  risePerSecondInCameraCone: 46,
  fallPerSecondHidden: 11,
  // Above this the guards leave their patrol and hunt the thief.
  alertThreshold: 40,
  caughtAt: 100,
};

export const TOOLS = {
  smokeCount: 2,
  smokeRadius: 95,
  smokeSeconds: 4,
  empCount: 1,
  empSeconds: 6,
};

export const SCORE = {
  sapphire: 500,
  smallLoot: 100,
  // Bonus for a quick, quiet getaway, shrinking with time and alarm.
  timeBonusMax: 300,
  alarmPenaltyPerPoint: 1,
};

export const LOOT = { sapphire: 'sapphire', vase: 'vase', painting: 'painting', jewels: 'jewels' };

export const SCREENS = {
  title: 'title',
  play: 'play',
  won: 'won',
  caught: 'caught',
};

export const COLORS = {
  floor: '#1c1a26',
  floorTile: '#232032',
  carpet: '#5e1f2e',
  carpetEdge: '#c9a227',
  wall: '#3a3348',
  wallTop: '#4d4460',
  cover: '#2e2a3d',
  coverEdge: '#6b5f86',
  glass: 'rgba(180, 220, 255, 0.16)',
  gold: '#e8c15a',
  sapphire: '#4fd8ff',
  thief: '#2b2b33',
  thiefTrim: '#b8b0ff',
  guard: '#31435c',
  guardTrim: '#ffcf5c',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneEdge: 'rgba(255, 214, 90, 0.55)',
  cameraCone: 'rgba(255, 90, 90, 0.16)',
  cameraConeEdge: 'rgba(255, 90, 90, 0.5)',
  smoke: 'rgba(200, 200, 215, 0.55)',
  exit: '#39d98a',
  exitLocked: '#8a8f9a',
  hud: '#14121c',
  hudText: '#f2ead8',
  alarmLow: '#39d98a',
  alarmMid: '#ffcf5c',
  alarmHigh: '#ff5252',
};
