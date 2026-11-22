// Drawing the night: the gallery floor, the cones, the thief, the loot and the
// alarm meter, all painted in code on one canvas. Nothing here is an image:
// every tile, statue and glint is a shape the renderer draws each frame.
import { VIEW, HUD_HEIGHT, ROOM, COLORS, ALARM, TOOLS, SCREENS, GUARD, CAMERA } from './config.js';

const CONE_RAYS = 26;

/** Where a ray from (ox, oy) along `angle` first hits a rectangle, in distance. */
function rayHitsRect(ox, oy, dx, dy, rect, maxDistance) {
  let best = Infinity;
  const edges = [
    [rect.x, rect.y, rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
    [rect.x, rect.y + rect.height, rect.x, rect.y],
  ];
  for (const [x1, y1, x2, y2] of edges) {
    const ex = x2 - x1;
    const ey = y2 - y1;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = ((x1 - ox) * ey - (y1 - oy) * ex) / denominator;
    const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denominator;
    if (t > 0 && t < best && t <= maxDistance && u >= 0 && u <= 1) best = t;
  }
  return best;
}

/** Where a ray from (ox, oy) along `angle` first hits a circle, in distance. */
function rayHitsCircle(ox, oy, dx, dy, circle, maxDistance) {
  const cx = circle.x - ox;
  const cy = circle.y - oy;
  const along = cx * dx + cy * dy;
  if (along < 0) return Infinity;
  const closestSquared = cx * cx + cy * cy - along * along;
  const radiusSquared = circle.radius * circle.radius;
  if (closestSquared > radiusSquared) return Infinity;
  const hit = along - Math.sqrt(radiusSquared - closestSquared);
  return hit > 0 && hit <= maxDistance ? hit : Infinity;
}

/**
 * The reach of one ray of a vision cone: the cone's range, shortened by the
 * first wall, case or statue it meets. This is what makes a cone stop at cover
 * instead of shining through it.
 */
function coneReach(ox, oy, angle, range, level) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = range;
  for (const wall of level.walls) best = Math.min(best, rayHitsRect(ox, oy, dx, dy, wall, range));
  for (const item of level.cover) {
    if (item.kind === 'statue') {
      best = Math.min(best, rayHitsCircle(ox, oy, dx, dy, item, range));
    } else {
      best = Math.min(best, rayHitsRect(ox, oy, dx, dy, item, range));
    }
  }
  return best;
}

/** Paint one vision cone, shaped by the room it sweeps through. */
function drawCone(ctx, ox, oy, angle, range, halfAngle, level, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const rayAngle = angle - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
    const reach = coneReach(ox, oy, rayAngle, range, level);
    ctx.lineTo(ox + Math.cos(rayAngle) * reach, oy + Math.sin(rayAngle) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFloor(ctx, level) {
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
  // Checkerboard marble tiles.
  const tile = 74;
  for (let ty = ROOM.y; ty < ROOM.y + ROOM.height; ty += tile) {
    for (let tx = ROOM.x; tx < ROOM.x + ROOM.width; tx += tile) {
      const column = Math.floor((tx - ROOM.x) / tile);
      const row = Math.floor((ty - ROOM.y) / tile);
      if ((column + row) % 2 === 0) {
        ctx.fillStyle = COLORS.floorTile;
        ctx.fillRect(tx, ty, tile, tile);
      }
    }
  }
  // The crimson carpet runner down the middle of the room.
  ctx.fillStyle = COLORS.carpet;
  ctx.fillRect(ROOM.x + 560, ROOM.y, 64, ROOM.height);
  ctx.fillStyle = COLORS.carpetEdge;
  ctx.fillRect(ROOM.x + 560, ROOM.y, 3, ROOM.height);
  ctx.fillRect(ROOM.x + 621, ROOM.y, 3, ROOM.height);
  // Walls, with a lighter top edge so the room reads at a glance.
  ctx.fillStyle = COLORS.wall;
  for (const wall of level.walls) ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  ctx.fillStyle = COLORS.wallTop;
  ctx.fillRect(ROOM.x - 16, ROOM.y - 16, ROOM.width + 32, 5);
  ctx.fillRect(ROOM.x - 16, ROOM.y - 16, 5, ROOM.height + 32);
}

function drawCover(ctx, level) {
  for (const item of level.cover) {
    if (item.kind === 'statue') {
      // A marble figure on a round plinth.
      ctx.fillStyle = '#8d86a0';
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfc8e0';
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8d86a0';
      ctx.beginPath();
      ctx.arc(item.x - item.radius * 0.18, item.y - item.radius * 0.2, item.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = COLORS.cover;
    ctx.fillRect(item.x, item.y, item.width, item.height);
    ctx.strokeStyle = COLORS.coverEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x + 1, item.y + 1, item.width - 2, item.height - 2);
    if (item.kind === 'case') {
      // Glass top with a glint, and the exhibit inside.
      ctx.fillStyle = COLORS.glass;
      ctx.fillRect(item.x + 4, item.y + 4, item.width - 8, item.height - 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(item.x + 10, item.y + item.height - 10);
      ctx.lineTo(item.x + item.width / 2, item.y + 10);
      ctx.stroke();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(item.x + item.width / 2, item.y + item.height / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'planter') {
      ctx.fillStyle = '#2f6b3a';
      ctx.beginPath();
      ctx.arc(item.x + item.width / 2, item.y + item.height / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f8b4c';
      ctx.beginPath();
      ctx.arc(item.x + item.width / 2 - 8, item.y + item.height / 2 - 6, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'bench') {
      ctx.fillStyle = '#7a2b3a';
      ctx.fillRect(item.x + 6, item.y + 8, item.width - 12, item.height - 16);
    }
  }
}

function drawDoors(ctx, level, sapphireTaken, time) {
  const exit = level.exit;
  const open = sapphireTaken;
  ctx.fillStyle = open ? COLORS.exit : COLORS.exitLocked;
  ctx.fillRect(exit.x - exit.width / 2, exit.y - exit.height / 2, exit.width, exit.height);
  ctx.fillStyle = '#0c0a12';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x, exit.y - 8);
  ctx.font = '10px sans-serif';
  ctx.fillText(open ? 'GO!' : 'NEED SAPPHIRE', exit.x, exit.y + 10);
  // The entrance door, where the thief slipped in.
  ctx.fillStyle = '#3a3348';
  ctx.fillRect(88, 580, 56, 64);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '11px sans-serif';
  ctx.fillText('IN', 116, 612);
  if (open) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.strokeStyle = `rgba(57, 217, 138, ${0.4 + pulse * 0.6})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x - exit.width / 2 - 4, exit.y - exit.height / 2 - 4, exit.width + 8, exit.height + 8);
  }
}

function drawLoot(ctx, state, time) {
  const level = state.level;
  const sparkle = 0.6 + 0.4 * Math.sin(time * 4);
  // The Starlight Sapphire, glowing on its pedestal.
  if (!state.sapphireTaken) {
    const { x, y } = level.sapphire;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 70);
    glow.addColorStop(0, `rgba(79, 216, 255, ${0.5 * sparkle})`);
    glow.addColorStop(1, 'rgba(79, 216, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3348';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.sapphire;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 13, y);
    ctx.lineTo(x, y + 18);
    ctx.lineTo(x - 13, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 4, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.sapphire;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STARLIGHT SAPPHIRE', x, y - 34);
  }
  // The smaller pieces, each with its own glint.
  for (const loot of level.smallLoot) {
    if (loot.taken) continue;
    const bob = Math.sin(time * 3 + loot.x) * 3;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(loot.x, loot.y + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(loot.x - 3, loot.y + bob - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(loot.label, loot.x, loot.y + bob + 24);
  }
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    drawCone(
      ctx,
      guard.x,
      guard.y,
      guard.angle,
      GUARD.visionRange,
      GUARD.visionHalfAngle,
      state.level,
      guard.hunting ? 'rgba(255, 82, 82, 0.22)' : COLORS.cone,
      guard.hunting ? 'rgba(255, 82, 82, 0.6)' : COLORS.coneEdge,
    );
    // The guard: a dark-blue figure with a gold trim and a torch beam.
    ctx.fillStyle = GUARD.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = guard.hunting ? '#ff5252' : COLORS.guardTrim;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = '#f2ead8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 8), guard.y + Math.sin(guard.angle) * (GUARD.radius + 8));
    ctx.stroke();
    // The guard's name, to the left so it never collides with a loot label.
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(guard.hunting ? '!' : guard.name, guard.x - GUARD.radius - 6, guard.y);
    ctx.textAlign = 'center';
    if (guard.hunting) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('!', guard.x, guard.y - GUARD.radius - 8);
    }
  }
}

function drawCameras(ctx, state, time) {
  for (const camera of state.cameras) {
    const disabled = state.empSecondsLeft > 0;
    if (!disabled) {
      drawCone(
        ctx,
        camera.x,
        camera.y,
        camera.angle,
        CAMERA.visionRange,
        CAMERA.visionHalfAngle,
        state.level,
        COLORS.cameraCone,
        COLORS.cameraConeEdge,
      );
    }
    // The camera body, mounted on the wall, with its blinking eye.
    ctx.fillStyle = '#22202e';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = disabled ? '#8a8f9a' : '#ff5252';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = disabled ? '#8a8f9a' : Math.sin(time * 6) > 0 ? '#ff5252' : '#7a1f1f';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a8f9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(camera.x + Math.cos(camera.angle) * 18, camera.y + Math.sin(camera.angle) * 18);
    ctx.stroke();
  }
}

function drawThief(ctx, state, time) {
  const thief = state.thief;
  const bob = thief.moving ? Math.sin(time * 14) * 2 : 0;
  // A soft shadow under the thief.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(thief.x, thief.y + 10, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // The hooded figure: dark cloak, pale mask, facing where it moves.
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.thiefTrim;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8e2f5';
  ctx.beginPath();
  ctx.arc(thief.x + Math.cos(thief.angle) * 5, thief.y + bob + Math.sin(thief.angle) * 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1a26';
  ctx.beginPath();
  ctx.arc(thief.x + Math.cos(thief.angle) * 7, thief.y + bob + Math.sin(thief.angle) * 7, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOK', thief.x, thief.y + bob - 22);
}

function drawSmoke(ctx, state) {
  for (const smoke of state.smokes) {
    const fade = Math.min(1, smoke.secondsLeft / 1.2);
    ctx.fillStyle = `rgba(200, 200, 215, ${0.5 * fade})`;
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(230, 230, 245, ${0.35 * fade})`;
    ctx.beginPath();
    ctx.arc(smoke.x - 25, smoke.y - 12, smoke.radius * 0.45, 0, Math.PI * 2);
    ctx.arc(smoke.x + 28, smoke.y + 14, smoke.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function alarmColor(alarm) {
  if (alarm < 40) return COLORS.alarmLow;
  if (alarm < 75) return COLORS.alarmMid;
  return COLORS.alarmHigh;
}

function drawHud(ctx, state) {
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('VELVET VAULT', 20, 20);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9a93ad';
  ctx.fillText('a midnight gallery heist', 20, 44);

  // The alarm meter: the heart of the game, always in view.
  const meterX = 330;
  const meterY = 18;
  const meterWidth = 420;
  const meterHeight = 22;
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ALARM', meterX, meterY - 8 + 11);
  ctx.fillStyle = '#2a2738';
  ctx.fillRect(meterX + 70, meterY, meterWidth, meterHeight);
  ctx.fillStyle = alarmColor(state.alarm);
  ctx.fillRect(meterX + 70, meterY, meterWidth * (state.alarm / ALARM.caughtAt), meterHeight);
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(meterX + 70, meterY, meterWidth, meterHeight);
  // The alert threshold tick.
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(meterX + 70 + meterWidth * (ALARM.alertThreshold / 100), meterY - 3);
  ctx.lineTo(meterX + 70 + meterWidth * (ALARM.alertThreshold / 100), meterY + meterHeight + 3);
  ctx.stroke();
  ctx.fillStyle = state.alarm >= ALARM.alertThreshold ? '#ff5252' : COLORS.hudText;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${Math.floor(state.alarm)}%`, meterX + 70 + meterWidth + 10, meterY + 11);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#9a93ad';
  ctx.fillText(state.alarm >= ALARM.alertThreshold ? 'GUARDS HUNTING!' : 'stay out of the cones', meterX + 70, meterY + meterHeight + 12);

  // Loot, tools, time and score, right-aligned.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px sans-serif';
  const lootText = `LOOT ${state.lootTaken}/3  ${state.sapphireTaken ? '◆ SAPPHIRE' : '◇ SAPPHIRE'}`;
  ctx.fillText(lootText, 1000, 18);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9a93ad';
  ctx.fillText(
    `SMOKE [Q] ×${state.smokeLeft}   EMP [E] ×${state.empLeft}${state.empSecondsLeft > 0 ? '  CAMERAS DOWN' : ''}`,
    1000,
    40,
  );
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`SCORE ${state.score}`, 1260, 18);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9a93ad';
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  ctx.fillText(`TIME ${minutes}:${String(seconds).padStart(2, '0')}`, 1260, 40);

  if (state.spotted && state.screen === SCREENS.play) {
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED — BREAK LINE OF SIGHT!', VIEW.width / 2, HUD_HEIGHT + 22);
  }
}

function drawPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(10, 8, 16, 0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#1c1a26';
  const panelWidth = 640;
  const panelHeight = 60 + lines.length * 30 + 70;
  const panelX = (VIEW.width - panelWidth) / 2;
  const panelY = (VIEW.height - panelHeight) / 2;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW.width / 2, panelY + 52);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '16px sans-serif';
  lines.forEach((line, index) => {
    ctx.fillText(line, VIEW.width / 2, panelY + 108 + index * 30);
  });
  ctx.fillStyle = '#9a93ad';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press ENTER or click to play again', VIEW.width / 2, panelY + panelHeight - 34);
}

function drawTitle(ctx, state) {
  drawPanel(
    ctx,
    'VELVET VAULT',
    [
      'One thief. One sapphire. Three guards, three cameras, one alarm.',
      'Cross the gallery, take the Starlight Sapphire, reach the EXIT.',
      'WASD / arrows to sneak — or click where to walk.',
      'Q drops smoke (×2) · E fires the EMP (×1) to blind the cameras.',
      'Stay out of the yellow cones. Red cones are the cameras.',
      'The alarm climbs while you are seen — at 100% the night is over.',
    ],
    COLORS.gold,
  );
}

function drawEnd(ctx, state) {
  if (state.screen === SCREENS.won) {
    drawPanel(
      ctx,
      'CLEAN GETAWAY!',
      [
        `The Starlight Sapphire is yours. Score ${state.score} — loot ${state.lootTaken}/3, sapphire taken.`,
        `Out in ${Math.floor(state.time)} seconds, alarm peaked at ${Math.floor(state.alarm)}%.`,
        'The guards are still arguing about the empty pedestal.',
      ],
      COLORS.exit,
    );
  } else if (state.screen === SCREENS.caught) {
    drawPanel(
      ctx,
      'CAUGHT!',
      [
        `The alarm hit 100% — ${state.caughtBy || 'the alarm'} raised it.`,
        `Score ${state.score} — the sapphire ${state.sapphireTaken ? 'was taken, but the getaway failed' : 'is still on its pedestal'}.`,
        'Next time: watch the cones sweep, and wait for the patrol to pass.',
      ],
      COLORS.alarmHigh,
    );
  }
}

/** Paint one frame of the game onto the canvas context (already scaled). */
export function drawGame(ctx, state) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawFloor(ctx, state.level);
  drawDoors(ctx, state.level, state.sapphireTaken, state.time);
  drawLoot(ctx, state, state.time);
  drawCover(ctx, state.level);
  drawCameras(ctx, state, state.time);
  drawGuards(ctx, state);
  drawThief(ctx, state, state.time);
  drawSmoke(ctx, state);
  drawHud(ctx, state);
  if (state.screen === SCREENS.title) drawTitle(ctx, state);
  if (state.screen === SCREENS.won || state.screen === SCREENS.caught) drawEnd(ctx, state);
  // A red vignette as the alarm climbs: the room itself feels the tension.
  if (state.alarm > 55 && state.screen === SCREENS.play) {
    const strength = ((state.alarm - 55) / 45) * 0.28;
    const edge = ctx.createRadialGradient(
      VIEW.width / 2,
      VIEW.height / 2,
      VIEW.height * 0.35,
      VIEW.width / 2,
      VIEW.height / 2,
      VIEW.height * 0.75,
    );
    edge.addColorStop(0, 'rgba(255, 40, 40, 0)');
    edge.addColorStop(1, `rgba(255, 40, 40, ${strength})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

export { TOOLS };
