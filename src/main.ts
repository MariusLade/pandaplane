import './styles.css';
import { Sound } from './core/audio';
import { Input } from './core/input';
import { autopilot } from './game/autopilot';
import { computeEarnings, updateRecords } from './game/economy';
import { Flight, type FlightInput } from './game/flight';
import { clearSave, loadSave, newSave, writeSave, type SaveData } from './game/save';
import { equipSensor, findItem, loadoutByIndex, loadoutFor, type Loadout, type ShopCategory } from './game/upgrades';
import { biomeAt, World } from './game/world';
import type { Mood } from './render/panda';
import { Renderer, type CameraMode } from './render/renderer';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { InstrumentPanel } from './ui/instruments';
import { buyQuip, quip, resultQuip } from './ui/quips';
import { Screens } from './ui/screens';

type Mode = 'title' | 'hangar' | 'flight' | 'results' | 'victory';

const STEP = 1 / 120;
/** Seconds to admire the landing before the flight log appears. */
const DONE_PAUSE = 0.8;
const DEMO_GEAR = loadoutByIndex({ ramp: 4, sled: 4, glider: 6, rocket: 3, fuel: 3 });
/** Minimum seconds between the panda's in-flight comments. */
const CHATTER_COOLDOWN = 2.5;

class Game {
  private save: SaveData;
  private hasSave: boolean;
  private world: World;
  private flight: Flight;
  private mode: Mode = 'title';
  private paused = false;
  private acc = 0;
  private time = 0;
  private last = performance.now();
  private doneTimer = 0;
  private lastImpact = 0;
  private biomeName = '';
  private pendingVictory = false;
  private lastChatter = -10;
  private honkTimer = 0;
  private wasBoosting = false;
  /** `?autopilot` in the URL lets the computer fly (handy for testing and demos). */
  private autopilot = new URLSearchParams(location.search).has('autopilot');

  private input = new Input();
  private sound = new Sound();
  private renderer: Renderer;
  private hud = new Hud();
  private instruments = new InstrumentPanel();
  private screens: Screens;
  private touch = $('#touch');
  private prompt = $('#prompt');

  constructor() {
    const loaded = loadSave();
    this.hasSave = loaded !== null;
    this.save = loaded ?? newSave();
    this.sound.muted = this.save.muted;
    this.world = new World(this.save.worldSeed, this.save.worldSeed + this.save.day * 7919);
    this.flight = this.makeDemo();
    this.renderer = new Renderer($('#game') as HTMLCanvasElement, this.save.worldSeed);

    this.input.onFirstGesture = () => this.sound.unlock();
    this.input.bindButton($('#btn-up'), 'up');
    this.input.bindButton($('#btn-down'), 'down');
    this.input.bindButton($('#btn-boost'), 'boost');
    this.prompt.addEventListener('pointerdown', () => this.startSlide());

    this.screens = new Screens({
      play: () => this.toHangar(),
      newGame: () => {
        clearSave();
        this.save = newSave();
        this.save.muted = this.sound.muted;
        this.renderer.bg.setSeed(this.save.worldSeed);
        this.toHangar();
      },
      openShop: (c) => this.openShop(c),
      closeShop: () => this.toHangar(quip('hangar')),
      buy: (c, id) => this.buy(c, id),
      equip: (c, id) => this.equip(c, id),
      unequipSensor: (id) => this.unequipSensor(id),
      launch: () => this.launch(),
      toTitle: () => this.toTitle(),
      toggleMute: () => {
        this.sound.muted = !this.sound.muted;
        this.save.muted = this.sound.muted;
        this.persist();
      },
      resume: () => this.setPaused(false),
      endFlight: () => {
        this.setPaused(false);
        this.flight.finish();
      },
      continueFromResults: () => {
        if (this.pendingVictory) {
          this.pendingVictory = false;
          this.mode = 'victory';
          this.sound.fanfare();
          this.screens.showVictory(this.save.goalDay ?? this.save.day);
        } else this.toHangar();
      },
      continueFromVictory: () => this.toHangar(),
      click: () => {
        this.sound.unlock();
        this.sound.click();
      },
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.instruments.layout();
    });
    // Tap the screen after a flight ends to jump straight to the results.
    $('#game').addEventListener('pointerdown', () => this.skipDoneWait());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'flight' && this.flight.phase !== 'done') this.setPaused(true);
    });

    this.screens.showTitle(this.hasSave, this.sound.muted);
    this.renderer.updateCamera(this.flight, 'ramp', 0, true);
    requestAnimationFrame((t) => this.frame(t));
  }

  private newWorld(): void {
    this.world = new World(this.save.worldSeed, this.save.worldSeed + this.save.day * 7919);
  }

  private makeDemo(): Flight {
    const world = new World(this.save.worldSeed, (Math.random() * 1e9) | 0);
    this.world = world;
    return new Flight(world, DEMO_GEAR);
  }

  private persist(): void {
    writeSave(this.save);
    this.hasSave = true;
  }

  private toTitle(): void {
    this.mode = 'title';
    this.flight = this.makeDemo();
    this.doneTimer = 0;
    this.renderer.particles.list.length = 0;
    this.renderer.updateCamera(this.flight, 'ramp', 0, true);
    this.showFlightUi(false);
    this.screens.showTitle(this.hasSave, this.sound.muted);
  }

  private toHangar(says?: string): void {
    this.mode = 'hangar';
    this.newWorld();
    this.flight = new Flight(this.world, this.gear());
    this.renderer.particles.list.length = 0;
    this.renderer.updateCamera(this.flight, 'hangar', 0, true);
    this.showFlightUi(false);
    this.screens.showHangar(this.save, says ?? quip(this.save.day === 1 ? 'hangarFirst' : 'hangar'));
  }

  private gear(): Loadout {
    return loadoutFor(this.save.equipped, this.save.sensors);
  }

  private openShop(category: ShopCategory, says?: string): void {
    this.screens.showShop(this.save, category, says ?? `Let's see what's in the ${category} shop…`);
  }

  private refreshGear(): void {
    this.flight = new Flight(this.world, this.gear());
  }

  private buy(category: ShopCategory, id: string): void {
    const item = findItem(category, id);
    if (!item) return;
    if (this.save.owned[category].includes(id)) return this.equip(category, id);
    if (this.save.money < item.cost) {
      this.sound.denied();
      this.openShop(category, quip('broke'));
      return;
    }
    this.save.money -= item.cost;
    this.save.owned = { ...this.save.owned, [category]: [...this.save.owned[category], id] };
    this.sound.buy();
    this.equip(category, id, buyQuip(category));
  }

  private equip(category: ShopCategory, id: string, says?: string): void {
    if (!this.save.owned[category].includes(id)) return;
    if (category === 'sensor') {
      const { sensors, removed } = equipSensor(this.save.sensors, id);
      this.save.sensors = sensors;
      if (removed.length) says = `${says ? `${says} ` : ''}Swapped out the ${removed.map((r) => r.name).join(' and ')}.`;
    } else {
      this.save.equipped = { ...this.save.equipped, [category]: id };
    }
    this.persist();
    this.refreshGear();
    this.openShop(category, says ?? quip('equip'));
  }

  private unequipSensor(id: string): void {
    this.save.sensors = this.save.sensors.filter((s) => s !== id);
    this.persist();
    this.refreshGear();
    this.openShop('sensor', quip('unequip'));
  }

  private launch(): void {
    this.mode = 'flight';
    this.newWorld();
    this.flight = new Flight(this.world, this.gear());
    this.screens.hide();
    this.wasBoosting = false;
    this.lastChatter = -10;
    this.doneTimer = 0;
    this.lastImpact = 0;
    this.acc = 0;
    this.biomeName = biomeAt(0).a.name;
    this.showFlightUi(true);
    this.hud.configure(this.flight);
    this.instruments.configure(this.flight);
    this.instruments.show(true);
    this.honkTimer = 0;
    this.prompt.hidden = false;
    this.prompt.textContent = this.input.touchSeen || matchMedia('(pointer: coarse)').matches ? 'Tap to slide!' : 'Press Space to slide!';
  }

  private startSlide(): void {
    if (this.mode !== 'flight' || this.flight.phase !== 'ready' || this.paused) return;
    this.sound.unlock();
    this.flight.start();
    this.prompt.hidden = true;
  }

  private showFlightUi(on: boolean): void {
    this.hud.show(on);
    this.instruments.show(on);
    const touch = this.input.touchSeen || matchMedia('(pointer: coarse)').matches;
    this.touch.hidden = !(on && touch);
    $('#btn-boost').hidden = this.flight.gear.rocket.thrust <= 0;
    if (!on) this.prompt.hidden = true;
  }

  private setPaused(p: boolean): void {
    if (this.mode !== 'flight') return;
    this.paused = p;
    if (p) {
      this.screens.showPause();
      this.sound.setFlight(0, false, false);
    } else this.screens.hide();
    this.last = performance.now();
  }

  private skipDoneWait(): void {
    // A short grace period so a button held through the landing doesn't skip by accident.
    if (this.mode === 'flight' && this.flight.phase === 'done' && this.doneTimer > 0.15) this.finishFlight();
  }

  private finishFlight(): void {
    const result = this.flight.result();
    const earnings = computeEarnings(result, this.save.best);
    const day = this.save.day;
    const says = earnings.newRecords.includes('distance')
      ? resultQuip('record')
      : result.distance < this.save.best.distance * 0.5
        ? resultQuip('short')
        : resultQuip('meh');
    this.save.money += earnings.total;
    this.save.totalEarned += earnings.total;
    this.save.best = updateRecords(this.save.best, result);
    if (result.reachedGoal && !this.save.goalReached) {
      this.save.goalReached = true;
      this.save.goalDay = day;
      this.pendingVictory = true;
    }
    this.save.day += 1;
    this.persist();
    this.mode = 'results';
    this.showFlightUi(false);
    this.screens.showResults(day, earnings, says, () => this.sound.cash());
  }

  private flightInput(): FlightInput {
    if (this.mode === 'title' || this.autopilot) return autopilot(this.flight);
    return { pitch: this.input.pitch, boost: this.input.isDown('boost') };
  }

  private mood(): Mood {
    const f = this.flight;
    if (f.phase === 'done') return this.lastImpact > 18 ? 'dizzy' : 'happy';
    if (f.phase === 'ready') return this.mode === 'hangar' && Math.sin(this.time * 0.3) > 0.9 ? 'sleepy' : 'happy';
    if (f.vy < -18 && f.altitudeAboveGround < 25) return 'scared';
    if (f.boosting || f.speed > 45) return 'excited';
    return 'happy';
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render(this.paused ? 0 : dt);
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number): void {
    this.time += dt;
    const f = this.flight;

    if ((this.mode === 'results' || this.mode === 'victory') && this.input.wasPressed('confirm')) {
      this.screens.advance();
      return;
    }

    if (this.mode === 'flight') {
      if (f.phase === 'done' && (this.input.wasPressed('confirm') || this.input.wasPressed('boost'))) {
        this.skipDoneWait();
        return;
      }
      if (this.input.wasPressed('pause')) {
        this.setPaused(true);
        return;
      }
      if (f.phase === 'ready' && (this.input.wasPressed('confirm') || this.input.wasPressed('boost'))) this.startSlide();
    }
    if (this.mode === 'title' && f.phase === 'ready' && this.time > 1) f.start();

    const simulate = this.mode === 'flight' || this.mode === 'title';
    if (simulate) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 12) {
        f.step(STEP, this.flightInput());
        this.acc -= STEP;
        steps++;
      }
      if (steps === 12) this.acc = 0;
      this.handleEvents();
      this.chatter();
    }

    if (this.mode === 'flight') {
      this.hud.update(f, this.save.best.distance);
      this.stallHorn(dt);
      const b = biomeAt(f.x);
      const name = b.t > 0.5 ? b.b.name : b.a.name;
      if (name !== this.biomeName) {
        this.biomeName = name;
        this.hud.showToast(name);
      }
      if (f.phase === 'done') {
        this.doneTimer += dt;
        if (this.doneTimer > DONE_PAUSE) this.finishFlight();
      }
    } else if (this.mode === 'title' && f.phase === 'done') {
      this.doneTimer += dt;
      if (this.doneTimer > 2.5) {
        this.doneTimer = 0;
        this.flight = this.makeDemo();
        this.renderer.updateCamera(this.flight, 'ramp', 0, true);
        this.time = 0;
      }
    }

    const active = (this.mode === 'flight' || this.mode === 'title') && f.phase !== 'ready' && f.phase !== 'done';
    this.sound.setFlight(f.speed, f.boosting, active && this.mode === 'flight');
  }

  /** The Stall Horn sensor honks while the wings are stalled. */
  private stallHorn(dt: number): void {
    const f = this.flight;
    const stalled = f.phase === 'air' && !f.onGround && f.stalled;
    if (!stalled || !f.gear.sensors.some((s) => s.features.includes('stallHorn'))) {
      this.honkTimer = 0;
      return;
    }
    this.honkTimer -= dt;
    if (this.honkTimer <= 0) {
      this.sound.honk();
      this.honkTimer = 0.4;
    }
  }

  /** The panda comments on what is happening, without spamming. */
  private chatter(): void {
    const f = this.flight;
    if (f.phase !== 'air') return;
    const free = this.time - this.lastChatter > CHATTER_COOLDOWN;
    if (f.boosting && !this.wasBoosting && free) this.say(quip('boost'));
    this.wasBoosting = f.boosting;
  }

  private say(text: string, force = false): void {
    if (!force && this.time - this.lastChatter < CHATTER_COOLDOWN) return;
    this.lastChatter = this.time;
    this.renderer.say(text);
  }

  private handleEvents(): void {
    const f = this.flight;
    const audible = this.mode === 'flight';
    for (const ev of f.events) {
      this.renderer.effect(ev, f);
      switch (ev.type) {
        case 'launch':
          this.say(quip('launch'), true);
          break;
        case 'impact':
          if (ev.amount > 12) this.say(quip('crash'));
          break;
        case 'splash':
          this.say(quip('splash'));
          break;
        case 'flap':
          if (ev.amount === 0) this.say(quip('lastFlap'));
          break;
        case 'bigcoin':
          this.say(quip('coin'));
          break;
        case 'ring':
          this.say(quip('ring'));
          break;
        case 'balloon':
          this.say(quip('balloon'));
          break;
        case 'goal':
          this.say(quip('goal'), true);
          break;
        case 'done':
          this.say(quip('done'), true);
          break;
        default:
          break;
      }
      if (!audible) continue;
      switch (ev.type) {
        case 'launch':
          this.sound.launch();
          break;
        case 'coin':
          this.sound.coin();
          break;
        case 'bigcoin':
          this.sound.coin(true);
          break;
        case 'ring':
          this.sound.ring();
          break;
        case 'balloon':
          this.sound.pop();
          break;
        case 'impact':
          this.lastImpact = ev.amount;
          this.sound.impact(ev.amount);
          break;
        case 'splash':
          this.sound.splash(ev.amount);
          break;
        case 'flap':
          this.sound.flap();
          break;
        case 'goal':
          this.sound.fanfare();
          this.hud.showToast('🎋 You reached Panda Paradise! 🎋', 4000);
          break;
        case 'done':
          break;
      }
    }
    f.events.length = 0;
  }

  private render(dt: number): void {
    const f = this.flight;
    const onRamp = (this.mode === 'flight' || this.mode === 'title') && f.phase === 'ready';
    const camMode: CameraMode = this.mode === 'hangar' ? 'hangar' : onRamp ? 'ramp' : 'follow';
    // Draw between the last two physics steps so motion is smooth at any refresh rate.
    const simulating = (this.mode === 'flight' || this.mode === 'title') && !this.paused;
    this.renderer.interpolate(f, simulating ? this.acc / STEP : 1);
    this.renderer.updateCamera(f, camMode, dt);
    this.renderer.draw(this.world, f, this.mood(), this.time, dt);
    if (this.mode === 'flight') this.instruments.draw(f, this.time, dt);
    if (this.mode === 'hangar') this.screens.tick(this.time);
  }
}

// Keep a reference for debugging in the console.
(window as unknown as { game: Game }).game = new Game();
