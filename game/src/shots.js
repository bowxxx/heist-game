// The screenshot scenes behind ?shot=heist|start|caught. Each one plays the real
// rules forward from a fresh night, so the frame is what a real game looks
// like and the same seed always gives the same frame.
//   heist  — the careful thief, mid-raid, closing in on the sapphire
//   start  — the title screen over the gallery at rest
//   caught — the reckless thief, walked straight into a cone, alarm at 100%
import { SCREENS } from './config.js';
import { createWorld, stepWorld, startGame } from './world.js';
import { autopilotMove, recklessMove } from './autopilot.js';

const STEP = 1 / 60;
const CAUGHT_LIMIT_SECONDS = 120;

/**
 * Set the world to the named scene and return the screen to draw over it.
 * Any name that is not heist or caught is the title scene.
 */
export function stageShot(name, world) {
  const fresh = createWorld(world.state.seed);
  world.state = fresh.state;
  world.level = fresh.level;
  if (name !== 'heist' && name !== 'caught') {
    // The title screen over the gallery at rest, guards on their first posts.
    world.state.screen = SCREENS.title;
    return SCREENS.title;
  }
  startGame(world);
  if (name === 'heist') {
    // The careful thief plays until it has all three small pieces and is
    // closing in on the sapphire (or 60 seconds pass): deep in the room,
    // loot collected, the sapphire still glowing on its pedestal, guards
    // and cameras all in view. Stopping before the grab keeps the loot
    // target visible in the frame. If that run is caught, fall back to a
    // shorter, safer window.
    for (const capSeconds of [60, 30, 18]) {
      const fresh = createWorld(world.state.seed);
      world.state = fresh.state;
      world.level = fresh.level;
      startGame(world);
      const steps = Math.floor(capSeconds / STEP);
      for (let i = 0; i < steps; i += 1) {
        if (world.state.screen !== SCREENS.play) break;
        const thief = world.state.thief;
        const sapphire = world.level.sapphire;
        if (world.state.lootTaken === 3 && Math.hypot(thief.x - sapphire.x, thief.y - sapphire.y) < 200) break;
        stepWorld(world, STEP, autopilotMove(world.state, STEP));
      }
      if (world.state.screen === SCREENS.play) return SCREENS.play;
    }
    return world.state.screen;
  }
  // The reckless thief walks straight at the loot until the alarm catches them.
  for (let i = 0; i < CAUGHT_LIMIT_SECONDS / STEP; i += 1) {
    if (world.state.screen !== SCREENS.play) break;
    stepWorld(world, STEP, recklessMove(world.state));
  }
  return world.state.screen;
}
