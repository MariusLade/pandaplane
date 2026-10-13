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

- **Sensors**: cockpit instruments on a panel at the bottom of the screen —
  airspeed indicator, vertical speed indicator, altimeter, radar altimeter
  with a TERRAIN light, pitch indicator, attitude indicator (artificial
  horizon with a flight-path marker), angle-of-attack gauge, fuel gauge, a
  STALL warning light, or the Wrist Computer's LCD. Without a sensor the
  reading is hidden. Equip several at once, but only one per slot (speed,
  altitude, pitch, stall, fuel); the Wrist Computer bundles three slots.

Many items also have a **perk** (purple badge in the shop): spring-loaded
kickers (Bamboo Catapult, Spring Board), an icy ramp deck (Ice Chute), sleds
that skim or bounce after landing (Frying Wok, Snow Surfboard, Bouncy Castle),
a Propeller Beanie that brakes every fall, a Flying Carpet that never stalls,
wings that flap when you press BOOST with an empty rocket (Feathered Wings,
Dragon Wings), a Cola Geyser that dumps all its fizz at once, a Steam Kettle
and Solar Panel that refill while you coast, an Afterburner that spools up to
double thrust, and a Nitro Canister that boosts any rocket.

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
`Space` starts the slide and fires the rocket, `Esc`/`P` pauses. After a
flight, `Space`/`Enter` (or a tap) skips the landing pause and the flight-log
animations, then continues.
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
- **Trees**: grown from seeds — layered conifers (snowy or not), recursively
  branching oaks, birches and cherry blossoms, bare winter trees, bamboo groves
  and bushes. Each is rendered once into a cached sprite sized to its exact
  bounds, and sways in the wind. Trees appear in groves and clearings, with a
  back row half-hidden behind the ridge for depth.
- **Ground**: wavy rock strata, embedded pebbles, grass tufts, snow glitter,
  rocks, flowers, mushrooms, snowmen and stone lanterns.
- **Ponds**: dips in the hills fill with water (or ice in the snow). Ice is
  slippery; land fast and shallow on water and you skip like a stone.
- **Scenery**: parallax mountain ranges with snow caps, clouds, and stars at
  high altitude.
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
