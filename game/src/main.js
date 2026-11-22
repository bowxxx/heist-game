// Velvet Vault: the entry point. It fits the canvas to the window, runs the
// game loop, and hands keys, clicks and screenshots to the world.
//   ?shot=heist|start|caught   stages a deterministic screenshot scene
//   ?autopilot=1               lets the autopilot play, for headless testing
import { VIEW, SCREENS } from './config.js';
import { createWorld, stepWorld, startGame } from './world.js';
import { createInput } from './input.js';
import { createSound } from './audio.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';
import { autopilotMove, recklessMove } from './autopilot.js';
import { EVENT_PICKUP, EVENT_SAPPHIRE, EVENT_SPOTTED, EVENT_CAUGHT, EVENT_ESCAPED, EVENT_SMOKE, EVENT_EMP } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const autopilotOn = params.get('autopilot') === '1';
const recklessOn = params.get('reckless') === '1';
const seed = Number(params.get('seed') || '1') || 1;

const world = createWorld(seed);
const input = createInput(canvas);
const sound = createSound();

if (shotName) {
  stageShot(shotName, world);
} else {
  world.state.screen = SCREENS.title;
}

/** Fit the 1280x720 room into the window, letterboxed, without stretching. */
function resizeCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const offsetX = (canvas.width - VIEW.width * scale * window.devicePixelRatio) / 2;
  const offsetY = (canvas.height - VIEW.height * scale * window.devicePixelRatio) / 2;
  ctx.setTransform(scale * window.devicePixelRatio, 0, 0, scale * window.devicePixelRatio, offsetX, offsetY);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function playEventSounds(events) {
  if (events & EVENT_PICKUP) sound.pickup();
  if (events & EVENT_SAPPHIRE) sound.sapphire();
  if (events & EVENT_SPOTTED) sound.spotted();
  if (events & EVENT_SMOKE) sound.smoke();
  if (events & EVENT_EMP) sound.emp();
  if (events & EVENT_CAUGHT) sound.caught();
  if (events & EVENT_ESCAPED) sound.escaped();
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const state = world.state;

  if (!shotName) {
    sound.unlock();
    if (input.takeStart()) {
      if (state.screen === SCREENS.title) {
        startGame(world);
        announce('The heist begins. Reach the sapphire, then the exit.');
      } else if (state.screen === SCREENS.won || state.screen === SCREENS.caught) {
        startGame(world);
        announce('A fresh night. The gallery waits.');
      }
    }
    if (state.screen === SCREENS.play) {
      let move;
      let tools;
      if (autopilotOn) {
        const pilot = autopilotMove(state, dt);
        move = { moveX: pilot.moveX, moveY: pilot.moveY };
        tools = { smoke: pilot.smoke, emp: pilot.emp };
      } else if (recklessOn) {
        const pilot = recklessMove(state);
        move = { moveX: pilot.moveX, moveY: pilot.moveY };
        tools = { smoke: false, emp: false };
      } else {
        move = input.readMove(state.thief);
        tools = input.takeTools();
      }
      const events = stepWorld(world, dt, { ...move, ...tools });
      playEventSounds(events);
      sound.setAlarmLevel(state.alarm / 100);
      if (events & EVENT_SAPPHIRE) announce('Sapphire taken! Get to the EXIT!');
      if (events & EVENT_CAUGHT) announce('Caught! The alarm hit 100 percent.');
      if (events & EVENT_ESCAPED) announce(`Clean getaway! Score ${state.score}.`);
    }
  }

  drawGame(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// A handle for the headless playtest: it reads the state and drives nothing.
window.__velvetVault = { world, startGame };
