// The autopilot: a stand-in thief that plays the real rules, used for the
// screenshots and for the headless playtest. It does not just look at where
// the cones are now — it predicts where they will be: cameras sweep on a
// fixed rhythm and guards walk their patrols (turning at their waypoints), so
// for each of the nine ways it could move it rolls the thief forward two
// seconds, adds up the danger along the way, and takes the way that gets
// closest to its target without being seen. When every way forward is watched,
// it waits behind cover for the patrol to pass; when it has waited too long
// with no progress, it spends a smoke pellet and pushes through.
import { GUARD, CAMERA, THIEF, ROOM } from './config.js';
import { insideCone, hasLineOfSight } from './vision.js';
import { moveBody } from './world.js';

const DIRECTIONS = [
  { x: 0, y: 0, wait: true },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

const HORIZON_SECONDS = 2;
const ROLL_STEP = 0.25;
const NEAR_SECONDS = 1;
const DANGER_WEIGHT = 1500;
const FAR_DANGER_WEIGHT = 400;
const MOVE_TAX = 25;
const STUCK_SECONDS = 6;
const PUSH_SECONDS = 4;

// The autopilot's memory across ticks: how long it has been stuck, and
// whether it is currently pushing through with smoke.
let lastSeenTime = -1;
let lastProgressTime = 0;
let lastDistance = Infinity;
let pushUntil = -1;

/** Where a guard will be `secondsAhead` from now, walking its patrol (or its hunt). */
function predictedGuard(guard, secondsAhead) {
  const speed = guard.hunting ? GUARD.alertSpeed : GUARD.patrolSpeed;
  if (guard.hunting) {
    const dx = guard.lastSeenX - guard.x;
    const dy = guard.lastSeenY - guard.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(distance, speed * secondsAhead);
    return {
      x: distance > 0 ? guard.x + (dx / distance) * travel : guard.x,
      y: distance > 0 ? guard.y + (dy / distance) * travel : guard.y,
      angle: distance > 2 ? Math.atan2(dy, dx) : guard.angle,
    };
  }
  let x = guard.x;
  let y = guard.y;
  let angle = guard.angle;
  let index = guard.waypointIndex;
  let remaining = secondsAhead;
  while (remaining > 0) {
    const target = guard.waypoints[(index + 1) % guard.waypoints.length];
    const dx = target.x - x;
    const dy = target.y - y;
    const distance = Math.hypot(dx, dy);
    const timeToTarget = distance / speed;
    if (timeToTarget <= remaining) {
      x = target.x;
      y = target.y;
      angle = Math.atan2(dy, dx);
      index = (index + 1) % guard.waypoints.length;
      remaining -= timeToTarget;
    } else {
      x += (dx / distance) * speed * remaining;
      y += (dy / distance) * speed * remaining;
      angle = Math.atan2(dy, dx);
      remaining = 0;
    }
  }
  return { x, y, angle };
}

/** Where a camera will be pointing `secondsAhead` from now. */
function predictedCameraAngle(camera, time, secondsAhead) {
  return camera.baseAngle + Math.sin((time + secondsAhead) * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
}

/** How much danger the thief would be in at (x, y), `secondsAhead` from now. */
function dangerAhead(state, x, y, secondsAhead) {
  let danger = 0;
  for (const guard of state.guards) {
    const future = predictedGuard(guard, secondsAhead);
    if (
      insideCone(x, y, future.x, future.y, future.angle, GUARD.visionRange, GUARD.visionHalfAngle) &&
      hasLineOfSight(future.x, future.y, x, y, state.level, state.smokes)
    ) {
      danger = Math.max(danger, 0.75);
    }
  }
  if (state.empSecondsLeft <= secondsAhead) {
    for (const camera of state.cameras) {
      const angle = predictedCameraAngle(camera, state.time, secondsAhead);
      if (
        insideCone(x, y, camera.x, camera.y, angle, CAMERA.visionRange, CAMERA.visionHalfAngle) &&
        hasLineOfSight(camera.x, camera.y, x, y, state.level, state.smokes)
      ) {
        danger = Math.max(danger, 1);
      }
    }
  }
  return danger;
}

/** The autopilot's next stop: small loot on the way, then the sapphire, then out. */
export function autopilotTarget(state) {
  const level = state.level;
  for (const loot of level.smallLoot) {
    if (!loot.taken) return { x: loot.x, y: loot.y };
  }
  if (!state.sapphireTaken) return { x: level.sapphire.x, y: level.sapphire.y };
  return { x: level.exit.x, y: level.exit.y };
}

/** The move for this tick: { moveX, moveY, smoke, emp }. */
export function autopilotMove(state, dt) {
  const target = autopilotTarget(state);
  const thief = state.thief;
  const distanceToTarget = Math.hypot(target.x - thief.x, target.y - thief.y);

  // A fresh run (the clock went backwards) clears the autopilot's memory.
  if (state.time < lastSeenTime) {
    lastProgressTime = 0;
    lastDistance = Infinity;
    pushUntil = -1;
  }
  lastSeenTime = state.time;
  if (distanceToTarget < lastDistance - 15) {
    lastDistance = distanceToTarget;
    lastProgressTime = state.time;
  }
  const stuck = state.time - lastProgressTime > STUCK_SECONDS;
  // A push is re-armed once the last one has expired: a thief that keeps
  // waiting has not solved the problem the push was meant to solve.
  if (stuck && state.time >= pushUntil && state.smokeLeft > 0) {
    pushUntil = state.time + PUSH_SECONDS;
  }
  const pushing = state.time < pushUntil;

  let best = DIRECTIONS[0];
  let bestScore = Infinity;
  // The eight compass ways, plus one aimed straight at the target: the grid
  // alone can strand the thief when the target sits between two of its
  // directions and every rollout overshoots it.
  const targetDx = target.x - thief.x;
  const targetDy = target.y - thief.y;
  const targetLength = Math.hypot(targetDx, targetDy) || 1;
  const candidates = [
    ...DIRECTIONS,
    { x: targetDx / targetLength, y: targetDy / targetLength, direct: true },
  ];
  // Spotted already? Then the job is to get out of the cone, not to creep
  // toward the loot: a thief that waits where it is seen is a caught thief.
  const dangerNow = dangerAhead(state, thief.x, thief.y, 0);
  for (const direction of candidates) {
    const length = Math.hypot(direction.x, direction.y) || 1;
    const stepX = (direction.x / length) * THIEF.speed * ROLL_STEP;
    const stepY = (direction.y / length) * THIEF.speed * ROLL_STEP;
    let x = thief.x;
    let y = thief.y;
    // The rollout body feels the same walls and cover the real thief does:
    // a straight line through a display case is not a way forward.
    const rolloutBody = { x, y, radius: THIEF.radius };
    let maxDangerNear = 0;
    let maxDangerFar = 0;
    let dangerAtHalf = 0;
    let dangerSum = 0;
    let dangerSteps = 0;
    let endDanger = 0;
    // Roll forward, but stop at the target: a rollout that runs past it
    // would score standing still as closer than walking there.
    for (let t = ROLL_STEP; t <= HORIZON_SECONDS; t += ROLL_STEP) {
      moveBody(rolloutBody, stepX, stepY, state.level);
      x = rolloutBody.x;
      y = rolloutBody.y;
      const danger = dangerAhead(state, x, y, t);
      if (t <= NEAR_SECONDS) maxDangerNear = Math.max(maxDangerNear, danger);
      maxDangerFar = Math.max(maxDangerFar, danger);
      if (Math.abs(t - 0.5) < ROLL_STEP / 2 + 0.01) dangerAtHalf = danger;
      dangerSum += danger;
      dangerSteps += 1;
      endDanger = danger;
      if (Math.hypot(target.x - x, target.y - y) < 24) break;
    }
    const distance = Math.hypot(target.x - x, target.y - y);
    const avgDanger = dangerSteps > 0 ? dangerSum / dangerSteps : 0;
    // The worst moment of the near rollout decides: a step that is seen
    // within the next second is a bad step, however briefly. The far rollout
    // counts less, since the thief will re-decide long before it gets there.
    // The half-second danger breaks ties toward the way out of a cone the
    // thief is already standing in. Danger dominates, unless the thief is
    // pushing through with smoke: then getting to the loot matters more
    // than staying unseen.
    let score;
    if (pushing) {
      score = distance + (direction.wait ? 8 : 0);
    } else if (dangerNow > 0) {
      // Escaping: how long the thief stays seen on the way out matters most,
      // then where it ends up; the loot can wait a second.
      score = avgDanger * 1500 + endDanger * 800 + maxDangerNear * 300 + distance * 0.3;
    } else {
      // A small tax on moving: a step that gains less than this over waiting
      // is not progress, it is pacing — the thief should hold its cover and
      // wait for the cone to sweep past instead of drifting back and forth.
      score =
        distance +
        maxDangerNear * DANGER_WEIGHT +
        maxDangerFar * FAR_DANGER_WEIGHT +
        dangerAtHalf * 300 +
        (direction.wait ? 8 : MOVE_TAX);
    }
    if (score < bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  // Smoke when spotted with the alarm climbing, or to cover a push.
  const inDanger = dangerAhead(state, thief.x, thief.y, 0) > 0;
  const smoke =
    state.smokeLeft > 0 &&
    state.smokes.length === 0 &&
    ((inDanger && state.alarm > 25) || pushing);
  const length = Math.hypot(best.x, best.y) || 1;
  return {
    moveX: best.x / length,
    moveY: best.y / length,
    smoke,
    emp: false,
  };
}

/** A reckless thief: straight at the target, blind to every cone. Used for the caught scene. */
export function recklessMove(state) {
  const target = autopilotTarget(state);
  const dx = target.x - state.thief.x;
  const dy = target.y - state.thief.y;
  const length = Math.hypot(dx, dy) || 1;
  return { moveX: dx / length, moveY: dy / length, smoke: false, emp: false };
}
