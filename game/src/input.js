// Keys and mouse: WASD or arrows to sneak, click to walk there, Q for smoke,
// E for EMP, Enter or click to start and to play again. The game reads this
// module's `readInput` each tick; the module never touches the world itself.
export function createInput(canvas) {
  const keys = new Set();
  let clickTarget = null;
  let smokePressed = false;
  let empPressed = false;
  let startPressed = false;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      if (key === 'q') smokePressed = true;
      if (key === 'e') empPressed = true;
      if (key === 'Enter' || key === ' ') startPressed = true;
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const offsetX = (rect.width - 1280 * scale) / 2;
    const offsetY = (rect.height - 720 * scale) / 2;
    clickTarget = {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
    startPressed = true;
  });

  return {
    /** The move vector for this tick, from keys or from the click target. */
    readMove(thief) {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x === 0 && y === 0 && clickTarget) {
        const dx = clickTarget.x - thief.x;
        const dy = clickTarget.y - thief.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 8) {
          clickTarget = null;
        } else {
          x = dx / distance;
          y = dy / distance;
        }
      } else if (x !== 0 || y !== 0) {
        clickTarget = null;
      }
      if (x !== 0 || y !== 0) {
        const length = Math.hypot(x, y);
        return { moveX: x / length, moveY: y / length };
      }
      return { moveX: 0, moveY: 0 };
    },
    /** One-shot presses, consumed when read. */
    takeTools() {
      const tools = { smoke: smokePressed, emp: empPressed };
      smokePressed = false;
      empPressed = false;
      return tools;
    },
    takeStart() {
      const pressed = startPressed;
      startPressed = false;
      return pressed;
    },
    clearClick() {
      clickTarget = null;
    },
  };
}
