# Panda Plane 🐼✈️

A web-based, mostly procedural 2D flying game inspired by *Learn to Fly*.
A panda slides down a ramp built into the mountainside, launches off the
kicker at the bottom, glides and rockets as far as possible, earns cash for
every flight and spends it on gear — day after day — until it reaches
**Panda Paradise**, 7,000 m beyond the mountains.

Reaching Panda Paradise unlocks a second map, **Ember Canyon**: sunset
mesas, a smoking volcano, lava pools and hostile skies, with the **Golden
Pagoda** 11,000 m away. It pays 1.6× and opens two new shops (Weapons and
Gadgets) plus top-tier gear. Reaching the pagoda unlocks a third map,
**Storm Coast**: a chain of islands across open sea under a brewing storm,
with **The Lighthouse** 15,000 m away (2.2× pay). Switch maps with the 🗺️
button in the hangar; each map keeps its own records and goal.

## Ember Canyon

- **Enemies**: crows dive at you, bats zigzag in fast, and red-panda bandits
  hover in hot-air balloons lobbing pinecones. Getting hit slows you down and
  knocks coins loose. Each one you shoot down pays a bounty.
- **Thermals**: shimmering columns of hot air over the canyon floor lift you
  (more so in the Lava Fields). Some gliders ride them better.
- **Lava**: pools in the dips. Touching one bounces you back up with a
  scorched tail instead of landing you.
- **Weapons** (fire where your nose points): Pea Shooter, Pinecone Slingshot
  (arcing, piercing), Firecracker Launcher (explodes), Bee Hive (homing
  bees), Snowball Gatling (fast) and Laser Monocle (instant beam). Each has
  damage, fire rate, ammo and weight.
- **Gadgets** (equip two): Coin Magnet, Lucky Bamboo (coins worth more), Ammo Belt
  (double ammo), Threat Radar (arrows to off-screen enemies), Bubble Shield
  (absorbs hits), Spiky Helmet (ram enemies) and Heat Suit (better lava
  bounces and thermals).
- **Canyon-only gear** (locked until the map unlocks): Volcano Ramp,
  Obsidian Board, Phoenix Wings, Magma Thruster and Lava Cell fuel.

## Storm Coast

- **Open sea**: islands poke out of the water. Land on the sea and you skid
  and skip, but it drags you down fast unless you have the right gear.
- **Wind gusts**: bands of streaking air. Tailwinds (blue) shove you
  forwards, headwinds (red) hold you back. A Wind Sock sensor shows the wind.
- **Lightning**: in the Open Sea and the Storm Front, strikes are telegraphed
  by a flickering column and a ring on the ground, then hit about a second
  later. They aim where you are heading, so change speed or height to dodge.
  They only strike below the storm clouds (~650 m) and fry enemies too.
- **Enemies**: seagulls cruise in and then swoop, and flying fish leap out of
  the sea to intercept you.
- **Storm gear** (locked until the map unlocks): Sea Cliff Ramp (tallest
  drop), Jet Ski (skims and skips on water), Storm Kite (rides gusts 70%
  harder), Thunderbolt rocket (lightning tops it up), Storm Battery, Thunder
  Staff (chain lightning that arcs to three more enemies), Wind Sock sensor,
  and gadgets: Water Wings (bounce off the sea), Pocket Sail (more wind) and
  Lightning Rod (a strike becomes a speed boost).

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
- **Weapons** and **Gadgets**: see Ember Canyon above.

- **Sensors**: cockpit instruments, each a chunky cartoon dial with its own
  name tag, tucked into the bottom corners of the screen (attitude and speed
  on the left, height, climb, fuel and wind on the right; beside the thumb
  buttons on touch screens). Airspeed indicator, vertical speed indicator,
  altimeter, radar altimeter with a TERRAIN light, pitch indicator, attitude
  indicator (artificial horizon with a flight-path marker), angle-of-attack
  gauge, fuel gauge, wind sock, a STALL warning light, or the Wrist
  Computer's LCD. Without a sensor the reading is hidden. Equip several at
  once, but only one per slot (speed, altitude, pitch, stall, fuel, wind);
  the Wrist Computer bundles three slots.

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
`Space` starts the slide and fires the rocket, `F`/`J`/`K`/`Ctrl` shoots,
`Esc`/`P` pauses. `Space`/`Enter` in the hangar launches. After a
flight, `Space`/`Enter` (or a tap) skips the landing pause and the flight-log
animations, then continues.
On touch screens, on-screen ▲ ▼, BOOST and (with a weapon) FIRE buttons
appear automatically.

Add `?autopilot` to the URL to let the computer fly (useful for testing).

Other scripts: `npm run build` (typecheck + production build into `dist/`),
`npm test` (unit + balance tests), `npm run typecheck`.

## What's procedural

Nothing is a bitmap or audio file — everything is generated at runtime:

- **Terrain**: seeded fractal noise; hills grow taller with distance. The
  landscape is fixed per save, pickups reshuffle every day.
- **Maps**: each map is a data description (`src/game/maps.ts`): biomes,
  terrain style, sky colours and payout. Ember Canyon uses terraced mesas;
  Storm Coast sinks its hills below a sea level so only islands remain.
- **Biomes**: Snowy Peaks → Pine Valley → Flower Meadows → Bamboo Forest →
  Panda Paradise; Ash Slopes → Red Canyon → Lava Fields → Crystal Ridge →
  Golden Pagoda; and Palm Beach → Coral Shallows → Open Sea → Storm Front →
  The Lighthouse, blended by distance (ground, decorations, sky tint, rain).
- **Enemies, thermals, gusts and lightning**: spawned from the biome's
  settings and a seeded RNG.
- **Trees**: grown from seeds — layered conifers (snowy or not), recursively
  branching oaks, birches and cherry blossoms, bare winter trees, bamboo groves
  and bushes; in the canyon, cacti, palms, shrubs and charred trunks. Each is rendered once into a cached sprite sized to its exact
  bounds, and sways in the wind. Trees appear in groves and clearings, with a
  back row half-hidden behind the ridge for depth.
- **Ground**: wavy rock strata, embedded pebbles, grass tufts, snow glitter,
  rocks, flowers, mushrooms, snowmen and stone lanterns.
- **Ponds**: dips in the hills fill with water (or ice in the snow). Ice is
  slippery; land fast and shallow on water and you skip like a stone.
- **Scenery**: parallax mountain ranges with snow caps, clouds, and stars at
  high altitude.
- **Pickups**: coin trails, big coins, boost rings and balloons, generated per
  60 m chunk. Collection is swept along the panda's path with a generous
  reach, so fast flights don't skip through coins or rings.
- **Ramps**: laid along the mountain profile, ending in a kicker curve
  (a Hermite spline tangent to the hillside) that sets the launch angle.
- **Panda**: body and head are one procedurally generated sprite: torso,
  neck, head, ears, tail and legs are unioned into a single outlined
  silhouette, shaded and patched, then baked per size into a cached
  offscreen canvas. An 8-frame cycle (breathing, head bob, ear wiggle,
  paddling feet) is baked in, it squashes and stretches live when boosting
  or flapping, and the face (blinks, moods: happy, excited, scared, dizzy,
  sleepy) is drawn live on top.
- **Gear**: drawn from canvas primitives, with running commentary in speech
  bubbles.
- **Rocket flame**: additive glow, flickering flame tongues, shock diamonds at
  full power, embers and billowing smoke; each rocket has its own palette.
- **Sound**: WebAudio synthesis (wind, rocket, coins, impacts, weapons,
  fanfare).

## Code layout

```
src/
  core/      engine-agnostic helpers: math, seeded RNG/noise, input, audio, storage
  game/      pure simulation (no DOM): flight physics, maps, world gen, combat, upgrades, economy, save
  render/    canvas rendering: camera, background, terrain, panda, enemies, pickups, particles
  ui/        DOM overlays: HUD, title, hangar, shops, results, pause, quips
  main.ts    game state machine and fixed-timestep loop (120 Hz)
tests/       vitest: world/RNG, economy, combat, storm, and a balance test that flies every tier
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
