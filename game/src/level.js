// The Velvet Vault gallery: one room, three ways across it.
// The thief enters at the bottom-left door, the Starlight Sapphire waits on its
// pedestal at the top, and the exit door at the bottom-right only opens once the
// sapphire is taken. Three routes cross the floor: the west wing past the cameras,
// the middle past the patrolling guards, and the east wing behind the statues.
// Cover (display cases, statues, planters, benches) blocks every line of sight,
// so a careful thief is never forced into the open.
import { ROOM } from './config.js';

/** A rectangle the thief cannot walk through and no eye can see through. */
function coverRect(x, y, width, height, label, kind = 'case') {
  return { x, y, width, height, label, kind };
}

/** A round statue: a circle of cover, drawn as a marble figure on a plinth. */
function statue(x, y, radius, label) {
  return { x, y, radius, label, kind: 'statue' };
}

export function buildLevel() {
  return {
    // The room's outer walls, as rectangles, for collision and vision blocking.
    walls: [
      { x: ROOM.x - 16, y: ROOM.y - 16, width: ROOM.width + 32, height: 16, label: 'north wall' },
      { x: ROOM.x - 16, y: ROOM.y + ROOM.height, width: ROOM.width + 32, height: 16, label: 'south wall' },
      { x: ROOM.x - 16, y: ROOM.y, width: 16, height: ROOM.height, label: 'west wall' },
      { x: ROOM.x + ROOM.width, y: ROOM.y, width: 16, height: ROOM.height, label: 'east wall' },
    ],
    // Cover the thief can hide behind. Gaps between them are the three routes.
    cover: [
      coverRect(268, 236, 150, 58, 'west display case'),
      coverRect(560, 250, 150, 58, 'middle display case'),
      coverRect(852, 236, 150, 58, 'east display case'),
      coverRect(180, 430, 62, 62, 'west planter', 'planter'),
      coverRect(1038, 452, 62, 62, 'east planter', 'planter'),
      coverRect(470, 560, 170, 42, 'velvet bench', 'bench'),
      coverRect(700, 430, 200, 52, 'long display case'),
      statue(640, 140, 30, 'marble statue'),
      statue(340, 560, 30, 'marble statue'),
      statue(980, 560, 30, 'marble statue'),
    ],
    // Where the thief starts, and where the getaway waits.
    entrance: { x: 116, y: 612 },
    exit: { x: 1168, y: 612, width: 80, height: 64 },
    // The prize, on its pedestal, and the three smaller pieces worth grabbing.
    sapphire: { x: 760, y: 150 },
    smallLoot: [
      { x: 300, y: 158, kind: 'vase', label: 'Ming vase', taken: false },
      { x: 940, y: 340, kind: 'painting', label: 'Gilded portrait', taken: false },
      { x: 420, y: 470, kind: 'jewels', label: 'Jewel casket', taken: false },
    ],
    // Guards walk their waypoints and look where they walk; the third walks
    // the east wing up and down, so no route is ever unguarded for long.
    guards: [
      {
        name: 'Guard Mara',
        waypoints: [
          { x: 280, y: 190 },
          { x: 620, y: 190 },
          { x: 1000, y: 190 },
          { x: 620, y: 190 },
        ],
        startIndex: 0,
      },
      {
        name: 'Guard Oka',
        waypoints: [
          { x: 200, y: 400 },
          { x: 640, y: 400 },
          { x: 1080, y: 400 },
          { x: 640, y: 400 },
        ],
        startIndex: 1,
      },
      {
        name: 'Guard Ilya',
        waypoints: [
          { x: 1120, y: 200 },
          { x: 1120, y: 580 },
        ],
        startIndex: 0,
      },
    ],
    // Cameras hang on the walls and sweep their cones back and forth.
    cameras: [
      { x: 500, y: ROOM.y + 2, baseAngle: Math.PI / 2, sweep: 0.7, phase: 0, label: 'Camera A' },
      { x: 1224, y: 360, baseAngle: Math.PI, sweep: 0.6, phase: 1.4, label: 'Camera B' },
      { x: 56, y: 300, baseAngle: 0, sweep: 0.6, phase: 2.6, label: 'Camera C' },
    ],
  };
}
