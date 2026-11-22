// The night itself: where everyone is, what the alarm thinks, and what happens
// each tick. The world knows nothing about drawing or keys; it takes a move
// direction and tool presses, and answers with the new state.
import { THIEF, GUARD, CAMERA, ALARM, TOOLS, SCORE, SCREENS, ROOM } from './config.js';
import { buildLevel } from './level.js';
import { detectionAt, hasLineOfSight } from './vision.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SAPPHIRE = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_ESCAPED = 16;
export const EVENT_SMOKE = 32;
export const EVENT_EMP = 64;

/** A fresh night: the thief at the door, the guards on their rounds, alarm at 0. */
export function createWorld(seed = 1) {
  const level = buildLevel();
  const state = {
    seed,
    screen: SCREENS.title,
    time: 0,
    alarm: 0,
    score: 0,
    lootTaken: 0,
    sapphireTaken: false,
    escaped: false,
    caughtBy: null,
    spotted: false,
    spotTime: 0,
    smokeLeft: TOOLS.smokeCount,
    empLeft: TOOLS.empCount,
    smokes: [],
    empSecondsLeft: 0,
    thief: { x: level.entrance.x, y: level.entrance.y, angle: -Math.PI / 2, moving: false, radius: THIEF.radius },
    guards: level.guards.map((guard) => ({
      name: guard.name,
      waypoints: guard.waypoints,
      waypointIndex: guard.startIndex,
      x: guard.waypoints[guard.startIndex].x,
      y: guard.waypoints[guard.startIndex].y,
      angle: 0,
      hunting: false,
      huntSecondsLeft: 0,
      lastSeenX: 0,
      lastSeenY: 0,
    })),
    cameras: level.cameras.map((camera) => ({ ...camera, angle: camera.baseAngle })),
    level,
  };
  // Guards start looking along their patrol, not at the wall.
  for (const guard of state.guards) {
    const next = guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length];
    guard.angle = Math.atan2(next.y - guard.y, next.x - guard.x);
  }
  return { state, level };
}

/** Push a circle out of a rectangle; returns true when it touched. */
function pushOutOfRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distance = Math.hypot(dx, dy);
  if (distance >= circle.radius) return false;
  if (distance < 0.001) {
    circle.y = rect.y - circle.radius;
    return true;
  }
  circle.x = closestX + (dx / distance) * circle.radius;
  circle.y = closestY + (dy / distance) * circle.radius;
  return true;
}

/** Push a circle out of a statue's circle. */
function pushOutOfCircle(circle, statue) {
  const dx = circle.x - statue.x;
  const dy = circle.y - statue.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = circle.radius + statue.radius;
  if (distance >= minDistance || distance < 0.001) return false;
  circle.x = statue.x + (dx / distance) * minDistance;
  circle.y = statue.y + (dy / distance) * minDistance;
  return true;
}

/** Move a body, sliding along walls and cover instead of sticking to them. Exported for the autopilot, whose rollouts must feel the same walls. */
export function moveBody(body, dx, dy, level) {
  body.x += dx;
  for (const wall of level.walls) pushOutOfRect(body, wall);
  for (const item of level.cover) {
    if (item.kind === 'statue') pushOutOfCircle(body, item);
    else pushOutOfRect(body, item);
  }
  body.x = Math.max(ROOM.x + body.radius, Math.min(ROOM.x + ROOM.width - body.radius, body.x));
  body.y += dy;
  for (const wall of level.walls) pushOutOfRect(body, wall);
  for (const item of level.cover) {
    if (item.kind === 'statue') pushOutOfCircle(body, item);
    else pushOutOfRect(body, item);
  }
  body.y = Math.max(ROOM.y + body.radius, Math.min(ROOM.y + ROOM.height - body.radius, body.y));
}

/** The shortest turn from `from` toward `to`, capped at `maxTurn` radians. */
function turnToward(from, to, maxTurn) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

/**
 * One tick of the night. `input` is { moveX, moveY, smoke, emp } with the move
 * vector already normalised. Returns an event bitmask for sound and feedback.
 */
export function stepWorld(world, dt, input) {
  const state = world.state;
  const level = world.level;
  let events = EVENT_NONE;
  if (state.screen !== SCREENS.play) return events;
  state.time += dt;

  // --- The thief moves, on keys or on a mouse click target. ---
  const thief = state.thief;
  const moving = input.moveX !== 0 || input.moveY !== 0;
  thief.moving = moving;
  if (moving) {
    thief.angle = Math.atan2(input.moveY, input.moveX);
    moveBody(thief, input.moveX * THIEF.speed * dt, input.moveY * THIEF.speed * dt, level);
  }

  // --- Tools: smoke hides, EMP blinds the cameras. ---
  if (input.smoke && state.smokeLeft > 0) {
    state.smokeLeft -= 1;
    state.smokes.push({ x: thief.x, y: thief.y, radius: TOOLS.smokeRadius, secondsLeft: TOOLS.smokeSeconds });
    events |= EVENT_SMOKE;
  }
  if (input.emp && state.empLeft > 0) {
    state.empLeft -= 1;
    state.empSecondsLeft = TOOLS.empSeconds;
    events |= EVENT_EMP;
  }
  for (const smoke of state.smokes) smoke.secondsLeft -= dt;
  state.smokes = state.smokes.filter((smoke) => smoke.secondsLeft > 0);
  if (state.empSecondsLeft > 0) state.empSecondsLeft -= dt;

  // --- Cameras sweep their cones. ---
  for (const camera of state.cameras) {
    camera.angle =
      camera.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
  }

  // --- Guards walk their rounds, or hunt the last place they saw the thief. ---
  for (const guard of state.guards) {
    const speed = guard.hunting ? GUARD.alertSpeed : GUARD.patrolSpeed;
    let target;
    if (guard.hunting) {
      target = { x: guard.lastSeenX, y: guard.lastSeenY };
      guard.huntSecondsLeft -= dt;
      if (guard.huntSecondsLeft <= 0) guard.hunting = false;
    } else {
      target = guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length];
    }
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 2) {
      const step = Math.min(distance, speed * dt);
      const nx = guard.x + (dx / distance) * step;
      const ny = guard.y + (dy / distance) * step;
      const before = { x: guard.x, y: guard.y, radius: GUARD.radius };
      moveBody(before, nx - guard.x, ny - guard.y, level);
      guard.x = before.x;
      guard.y = before.y;
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 6 * dt);
    }
    if (!guard.hunting && distance <= 4) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    }
  }

  // --- Being seen: the alarm climbs in a cone, and falls when hidden. ---
  const camerasOff = state.empSecondsLeft > 0;
  const { seen, watcher } = detectionAt(
    thief.x,
    thief.y,
    state.guards,
    state.cameras,
    level,
    state.smokes,
    camerasOff,
  );
  const wasSpotted = state.spotted;
  state.spotted = seen > 0;
  if (seen > 0) {
    state.spotTime += dt;
    const rate = seen >= 1 ? ALARM.risePerSecondInCameraCone : ALARM.risePerSecondInGuardCone;
    // The first glimpse is only suspicion: the alarm waits out the grace period.
    if (state.spotTime > THIEF.graceSeconds) state.alarm += rate * dt;
    if (!wasSpotted) events |= EVENT_SPOTTED;
    if (watcher && watcher.name) {
      watcher.lastSeenX = thief.x;
      watcher.lastSeenY = thief.y;
    }
  } else {
    state.spotTime = 0;
    state.alarm = Math.max(0, state.alarm - ALARM.fallPerSecondHidden * dt);
  }
  if (state.alarm >= ALARM.alertThreshold) {
    for (const guard of state.guards) {
      if (!guard.hunting) {
        guard.hunting = true;
        guard.huntSecondsLeft = GUARD.huntSeconds;
        guard.lastSeenX = thief.x;
        guard.lastSeenY = thief.y;
      }
    }
  }
  state.alarm = Math.min(ALARM.caughtAt, state.alarm);

  // --- Loot: the small pieces, then the sapphire itself. ---
  for (const loot of level.smallLoot) {
    if (!loot.taken && Math.hypot(thief.x - loot.x, thief.y - loot.y) < THIEF.radius + 26) {
      loot.taken = true;
      state.lootTaken += 1;
      state.score += SCORE.smallLoot;
      events |= EVENT_PICKUP;
    }
  }
  if (!state.sapphireTaken && Math.hypot(thief.x - level.sapphire.x, thief.y - level.sapphire.y) < THIEF.radius + 30) {
    state.sapphireTaken = true;
    state.score += SCORE.sapphire;
    events |= EVENT_SAPPHIRE;
  }

  // --- Caught, or away clean through the exit. ---
  if (state.alarm >= ALARM.caughtAt) {
    state.screen = SCREENS.caught;
    state.caughtBy = watcher ? watcher.name || watcher.label : 'the alarm';
    events |= EVENT_CAUGHT;
    return events;
  }
  const exit = level.exit;
  if (
    state.sapphireTaken &&
    thief.x > exit.x - exit.width / 2 &&
    thief.x < exit.x + exit.width / 2 &&
    thief.y > exit.y - exit.height / 2 &&
    thief.y < exit.y + exit.height / 2
  ) {
    state.screen = SCREENS.won;
    state.escaped = true;
    const timeBonus = Math.max(0, SCORE.timeBonusMax - Math.floor(state.time) * 2);
    const alarmPenalty = Math.floor(state.alarm) * SCORE.alarmPenaltyPerPoint;
    state.score += Math.max(0, timeBonus - alarmPenalty);
    events |= EVENT_ESCAPED;
  }
  return events;
}

/** Start a fresh night from the title screen. */
export function startGame(world) {
  const fresh = createWorld(world.state.seed);
  world.state = fresh.state;
  world.level = fresh.level;
  world.state.screen = SCREENS.play;
}

/** The thief's distance to a point, for the autopilot and the HUD hints. */
export function distanceTo(thief, x, y) {
  return Math.hypot(thief.x - x, thief.y - y);
}

export { hasLineOfSight };
