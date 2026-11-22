// Seeing and being seen: vision cones, and the line of sight that cover breaks.
// A guard or a camera only spots the thief when the thief stands inside its cone
// AND no wall or cover lies between them. Smoke counts as cover too.
import { GUARD, CAMERA } from './config.js';

/** True when the point (x, y) lies inside the cone from (ox, oy), facing `angle`. */
export function insideCone(x, y, ox, oy, angle, range, halfAngle) {
  const dx = x - ox;
  const dy = y - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 1) return true;
  const facingX = Math.cos(angle);
  const facingY = Math.sin(angle);
  const dot = (dx * facingX + dy * facingY) / distance;
  return dot >= Math.cos(halfAngle);
}

/** True when the segment (x1, y1)-(x2, y2) touches the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < rect.x || minX > rect.x + rect.width) return false;
  if (maxY < rect.y || minY > rect.y + rect.height) return false;
  if (x1 >= rect.x && x1 <= rect.x + rect.width && y1 >= rect.y && y1 <= rect.y + rect.height) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.width && y2 >= rect.y && y2 <= rect.y + rect.height) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Check each of the rectangle's four edges for a crossing.
  const edges = [
    [rect.x, rect.y, rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
    [rect.x, rect.y + rect.height, rect.x, rect.y],
  ];
  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segmentsCross(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return true;
  }
  return false;
}

/** True when two segments cross (including touching at an endpoint). */
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = direction(cx, cy, dx, dy, ax, ay);
  const d2 = direction(cx, cy, dx, dy, bx, by);
  const d3 = direction(ax, ay, bx, by, cx, cy);
  const d4 = direction(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(px, py, qx, qy, rx, ry) {
  return (rx - px) * (qy - py) - (qx - px) * (ry - py);
}

/** True when the segment touches the circle (a statue). */
export function segmentHitsCircle(x1, y1, x2, y2, circle) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  let t = 0;
  if (lengthSquared > 0) {
    t = Math.max(0, Math.min(1, ((circle.x - x1) * dx + (circle.y - y1) * dy) / lengthSquared));
  }
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.hypot(circle.x - closestX, circle.y - closestY) <= circle.radius;
}

/**
 * True when nothing blocks the view from (x1, y1) to (x2, y2): no wall, no
 * cover, no statue, and the target is not inside a smoke cloud.
 */
export function hasLineOfSight(x1, y1, x2, y2, level, smokes) {
  for (const wall of level.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  for (const item of level.cover) {
    if (item.kind === 'statue') {
      if (segmentHitsCircle(x1, y1, x2, y2, item)) return false;
    } else if (segmentHitsRect(x1, y1, x2, y2, item)) {
      return false;
    }
  }
  for (const smoke of smokes) {
    if (Math.hypot(x2 - smoke.x, y2 - smoke.y) <= smoke.radius) return false;
  }
  return true;
}

/**
 * How strongly the thief is being seen right now: 0 when hidden, up to 1 when
 * a camera stares straight at them. Guards and cameras add up, so stepping
 * into two cones at once is worse than one.
 */
export function detectionAt(thiefX, thiefY, guards, cameras, level, smokes, camerasDisabled) {
  let seen = 0;
  let watcher = null;
  for (const guard of guards) {
    if (
      insideCone(thiefX, thiefY, guard.x, guard.y, guard.angle, GUARD.visionRange, GUARD.visionHalfAngle) &&
      hasLineOfSight(guard.x, guard.y, thiefX, thiefY, level, smokes)
    ) {
      seen = Math.max(seen, 0.75);
      watcher = guard;
    }
  }
  if (!camerasDisabled) {
    for (const camera of cameras) {
      if (
        insideCone(thiefX, thiefY, camera.x, camera.y, camera.angle, CAMERA.visionRange, CAMERA.visionHalfAngle) &&
        hasLineOfSight(camera.x, camera.y, thiefX, thiefY, level, smokes)
      ) {
        seen = Math.max(seen, 1);
        watcher = camera;
      }
    }
  }
  return { seen, watcher };
}
