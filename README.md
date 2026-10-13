# Panda Plane 🐼✈️

A web-based, mostly procedural 2D flying game inspired by *Learn to Fly*.
A panda slides down a ramp built into the mountainside, launches off the
kicker at the bottom, glides and rockets as far as possible, earns cash for
every flight and spends it on gear — day after day — until it reaches
**Panda Paradise**, 7,000 m beyond the mountains.

## Building your flying machine

The hangar has a shop for each kind of gear: ramps, sleds, gliders, rockets
and fuel tanks. Items are sorted from cheapest to most expensive, but they are
not a straight ladder: each one trades things off, and you buy and equip
whatever suits your build. Every item card shows its stats, with ▲/▼ arrows
compared to what you have equipped.

- **Ramps**: drop height and launch angle (flat & fast vs. steep & high).
- **Sleds**: friction on the ramp, air drag, and weight.
- **Gliders**: updraft (how slowly they can fly), glide ratio, control
  (how fast you can tilt), and weight.
- **Rockets**: thrust, how fast they burn fuel, and weight.
- **Fuel tanks**: capacity and weight.

- **Sensors**: instruments that reveal readings in flight — speed, climb
  rate, altitude or height above ground, pitch, an attitude indicator, fuel,
  a stall horn or a stall-margin (angle of attack) meter. Without a sensor the
  reading is hidden. Equip several at once, but only one per slot (speed,
  altitude, pitch, stall, fuel); the Wrist Computer bundles three slots.

Weight matters everywhere: a heavy build keeps its speed but sinks faster and
accelerates slower.

The panda holds whatever pitch you give it — there is no auto-leveling — so
avoiding stalls is up to you (and your instruments).

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
- **Ramps**: laid along the mountain profile, ending in a kicker curve
  (a Hermite spline tangent to the hillside) that sets the launch angle.
- **Panda & gear**: drawn from canvas primitives (8 sleds, 8 gliders,
  7 rockets) with moods (happy, excited, scared, dizzy, sleepy) and running
  commentary in speech bubbles.
- **Sound**: WebAudio synthesis (wind, rocket, coins, impacts, fanfare).

## Code layout

```
src/
  core/      engine-agnostic helpers: math, seeded RNG/noise, input, audio, storage
  game/      pure simulation (no DOM): flight physics, world gen, upgrades, economy, save
  render/    canvas rendering: camera, background, terrain, panda, pickups, particles
  ui/        DOM overlays: HUD, title, hangar, shops, results, pause, quips
  main.ts    game state machine and fixed-timestep loop (120 Hz)
tests/       vitest: world/RNG, economy, and a balance test that flies every tier
```

Balancing lives in `src/game/upgrades.ts` (the item catalogue — gliders are
defined by intuitive design numbers like stall speed and glide ratio, which are
converted to physics coefficients), `src/game/stats.ts` (what the shop shows)
and `src/game/constants.ts` (physics). `tests/balance.test.ts` flies builds
from cheapest to priciest with an autopilot and prints a progression table —
run `npx vitest run --reporter=verbose` after tweaking numbers.

Rendering interpolates between the last two 120 Hz physics steps, so motion
stays smooth on 60 Hz, 144 Hz or uneven frame rates.

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
