# Panda Plane 🐼✈️

A web-based, mostly procedural 2D flying game inspired by *Learn to Fly*.
A panda launches off a ramp, glides and rockets as far as possible, earns cash
for every flight and spends it on better gear — day after day — until it
reaches **Panda Paradise**, 7,000 m beyond the mountains.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

Controls (PC): `↑`/`↓` or `W`/`S` (also `←`/`→`, `A`/`D`) tilt the nose,
`Space` starts the slide and fires the rocket, `Esc`/`P` pauses.
On touch screens, on-screen ▲ ▼ and BOOST buttons appear automatically.

Add `?autopilot` to the URL to let the computer fly (useful for testing).

Other scripts: `npm run build` (typecheck + production build into `dist/`),
`npm test` (unit + balance tests), `npm run typecheck`.

## What's procedural

Nothing is a bitmap or audio file — everything is generated at runtime:

- **Terrain**: seeded fractal noise; hills grow taller with distance. The
  landscape is fixed per save, pickups reshuffle every day.
- **Biomes**: Snowy Peaks → Pine Valley → Flower Meadows → Bamboo Forest →
  Panda Paradise, blended by distance (ground, decorations, sky tint).
- **Scenery**: parallax mountain ranges with snow caps, clouds, stars at high
  altitude, trees / bamboo / flowers placed by hash.
- **Pickups**: coin trails, big coins, boost rings and balloons, generated per
  60 m chunk.
- **Ramps**: built by integrating a curve so every tier has a smooth profile.
- **Panda & gear**: drawn from canvas primitives (6 sleds, 5 gliders,
  5 rockets) with moods (happy, excited, scared, dizzy, sleepy).
- **Sound**: WebAudio synthesis (wind, rocket, coins, impacts, fanfare).

## Code layout

```
src/
  core/      engine-agnostic helpers: math, seeded RNG/noise, input, audio, storage
  game/      pure simulation (no DOM): flight physics, world gen, upgrades, economy, save
  render/    canvas rendering: camera, background, terrain, panda, pickups, particles
  ui/        DOM overlays: HUD, title, hangar, results, pause
  main.ts    game state machine and fixed-timestep loop (120 Hz)
tests/       vitest: world/RNG, economy, and a balance test that flies every tier
```

Balancing lives in `src/game/upgrades.ts` (gear tiers) and
`src/game/constants.ts` (physics). `tests/balance.test.ts` flies each gear tier
with an autopilot and prints a progression table — run
`npx vitest run --reporter=verbose` after tweaking numbers.

## Porting to mobile later

The code is already set up for it:

- Input is action-based (`src/core/input.ts`); touch buttons feed the same
  actions as the keyboard.
- The canvas is DPR-aware and the camera sizes the view by the limiting screen
  dimension, so portrait and landscape both work. Safe-area insets are respected.
- Persistence goes through `src/core/storage.ts` — swap in Capacitor
  Preferences (or similar) there.
- Audio unlocks on the first gesture, as mobile browsers require.
- The build uses relative paths (`base: './'`), so `dist/` can be dropped into
  a Capacitor/Cordova WebView as-is. A web manifest is included for
  "add to home screen".
