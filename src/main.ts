import './styles.css';
import { Sound } from './core/audio';
import { Input } from './core/input';
import { autopilot } from './game/autopilot';
import { computeEarnings, updateRecords } from './game/economy';
import { Flight, type FlightInput } from './game/flight';
import { clearSave, loadSave, newSave, writeSave, type SaveData } from './game/save';
import { loadoutFor, nextTier, type Category, type Levels } from './game/upgrades';
import { biomeAt, World } from './game/world';
import type { Mood } from './render/panda';
import { Renderer, type CameraMode } from './render/renderer';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';

type Mode = 'title' | 'hangar' | 'flight' | 'results' | 'victory';

const STEP = 1 / 120;
const DEMO_LEVELS: Levels = { ramp: 3, sled: 3, glider: 3, rocket: 2, fuel: 2 };

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
  /** `?autopilot` in the URL lets the computer fly (handy for testing and demos). */
  private autopilot = new URLSearchParams(location.search).has('autopilot');

  private input = new Input();
  private sound = new Sound();
  private renderer: Renderer;
  private hud = new Hud();
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
      buy: (c) => this.buy(c),
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

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'flight' && this.flight.phase !== 'done') this.setPaused(true);
    });

    this.screens.showTitle(this.hasSave, this.sound.muted);
    this.renderer.updateCamera(this.flight, 'ramp', 0, true);
    requestAnimationFrame((t) => this.frame(t));
  }

  private get levels(): Levels {
    return this.save.levels;
  }

  private newWorld(): void {
    this.world = new World(this.save.worldSeed, this.save.worldSeed + this.save.day * 7919);
  }

  private makeDemo(): Flight {
    const world = new World(this.save.worldSeed, (Math.random() * 1e9) | 0);
    this.world = world;
    return new Flight(world, loadoutFor(DEMO_LEVELS));
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

  private toHangar(): void {
    this.mode = 'hangar';
    this.newWorld();
    this.flight = new Flight(this.world, loadoutFor(this.levels));
    this.renderer.particles.list.length = 0;
    this.renderer.updateCamera(this.flight, 'hangar', 0, true);
    this.showFlightUi(false);
    this.screens.showHangar(this.save);
  }

  private buy(category: Category): void {
    const next = nextTier(category, this.levels);
    if (!next || this.save.money < next.cost) {
      this.sound.denied();
      return;
    }
    this.save.money -= next.cost;
    this.save.levels = { ...this.levels, [category]: this.levels[category] + 1 };
    this.persist();
    this.sound.buy();
    this.flight = new Flight(this.world, loadoutFor(this.levels));
    this.screens.showHangar(this.save);
  }

  private launch(): void {
    this.mode = 'flight';
    this.newWorld();
    this.flight = new Flight(this.world, loadoutFor(this.levels));
    this.screens.hide();
    this.doneTimer = 0;
    this.lastImpact = 0;
    this.acc = 0;
    this.biomeName = biomeAt(0).a.name;
    this.showFlightUi(true);
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

  private finishFlight(): void {
    const result = this.flight.result();
    const earnings = computeEarnings(result, this.save.best);
    const day = this.save.day;
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
    this.screens.showResults(day, earnings, () => this.sound.cash());
  }

  private flightInput(): FlightInput {
    if (this.mode === 'title' || this.autopilot) return autopilot(this.flight);
    return { pitch: this.input.pitch, boost: this.input.isDown('boost') };
  }

  private mood(): Mood {
    const f = this.flight;
    if (f.phase === 'done') return this.lastImpact > 18 ? 'dizzy' : 'happy';
    if (f.phase === 'ready') return this.mode === 'hangar' && Math.sin(this.time * 0.3) > 0.9 ? 'sleepy' : 'happy';
    if (f.stalled || (f.vy < -18 && f.altitudeAboveGround < 25)) return 'scared';
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

    if (this.mode === 'flight') {
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
    }

    if (this.mode === 'flight') {
      this.hud.update(f, this.save.best.distance);
      const b = biomeAt(f.x);
      const name = b.t > 0.5 ? b.b.name : b.a.name;
      if (name !== this.biomeName) {
        this.biomeName = name;
        this.hud.showToast(name);
      }
      if (f.phase === 'done') {
        this.doneTimer += dt;
        if (this.doneTimer > 1.6) this.finishFlight();
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

  private handleEvents(): void {
    const f = this.flight;
    const audible = this.mode === 'flight';
    for (const ev of f.events) {
      this.renderer.effect(ev, f);
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
    this.renderer.updateCamera(f, camMode, dt);
    this.renderer.draw(this.world, f, this.mood(), this.time, dt);
    if (this.mode === 'hangar') this.screens.tick(this.time);
  }
}

// Keep a reference for debugging in the console.
(window as unknown as { game: Game }).game = new Game();
