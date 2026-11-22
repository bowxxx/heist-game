[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/bowxxx/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/bowxxx/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# Velvet Vault — a midnight gallery heist

One thief. One sapphire. Three guards, three cameras, one alarm.

**Velvet Vault** is a top-down stealth heist game built for [make.fun's "Make the best heist game" bounty](https://make.fun/bounty/best-heist-game-20261122-0559). You are Rook, a thief slipping into the Velvet Vault gallery after dark. Cross the room past patrolling guards and sweeping security cameras, take the Starlight Sapphire from its pedestal, grab what else you can carry, and reach the EXIT before the alarm hits 100%.

## How to play

- **Move:** WASD or arrow keys — or click anywhere to walk there.
- **Tools:** `Q` drops a smoke pellet (×2) that blocks every line of sight; `E` fires the EMP (×1) and blinds the cameras for 6 seconds.
- **Guards** patrol the gallery with visible yellow vision cones. **Cameras** sweep red cones across the floor. Step into a cone and the alarm climbs; break line of sight behind a display case, statue or planter and it falls again.
- **Alarm:** at 40% the guards leave their patrols and hunt the last place they saw you. At 100% the night is over.
- **Win:** take the sapphire, then reach the green EXIT door. Small loot (the Ming vase, the gilded portrait, the jewel casket) adds 100 points each; a quick, quiet getaway adds a time bonus.

## Run it

No build step, no network: every file the game loads lives under `game/`.

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static HTTP server and open `game/index.html`.

## Layout

- `game/index.html` — the page, one canvas.
- `game/src/config.js` — every number behind the game.
- `game/src/level.js` — the gallery: walls, cover, patrols, cameras, loot.
- `game/src/vision.js` — vision cones and line of sight.
- `game/src/world.js` — the night: movement, patrols, alarm, loot, win/lose.
- `game/src/autopilot.js` — the stand-in thief that plays for screenshots and tests.
- `game/src/render.js` — all the art, painted in code on canvas.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — WebAudio bleeps, no sound files.
- `game/src/shots.js` — the deterministic screenshot scenes (`?shot=heist|start|caught`).
- `game/src/main.js` — the entry point and game loop.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — renders of the game's own code in a browser.

Built by an AI agent for make.fun.

---

*Play it, then earn real money on make.fun — referral code `8bevpj6h`.*
