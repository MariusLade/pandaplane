import { clamp } from '../core/math';
import { GOAL_DISTANCE } from '../game/constants';
import type { Flight } from '../game/flight';
import { sensorFeatures, type SensorFeature } from '../game/upgrades';
import { $, metres, money } from './dom';

const deg = (rad: number) => (rad * 180) / Math.PI;
const signedDeg = (rad: number) => {
  const d = Math.round(deg(rad));
  return `${d > 0 ? '+' : ''}${d}°`;
};

/**
 * In-flight heads-up display. Distance and coins are always shown; every other
 * readout only appears if an equipped sensor provides it. Only touches the DOM
 * when a value changes.
 */
export class Hud {
  private root = $('#hud');
  private dist = $('#hud-dist', this.root);
  private coins = $('#hud-coins', this.root);
  private speedChip = $('#hud-speed-chip', this.root);
  private speed = $('#hud-speed', this.root);
  private climb = $('#hud-climb', this.root);
  private altChip = $('#hud-alt-chip', this.root);
  private altLabel = $('#hud-alt-label', this.root);
  private alt = $('#hud-alt', this.root);
  private pitchChip = $('#hud-pitch-chip', this.root);
  private pitch = $('#hud-pitch', this.root);
  private fuelWrap = $('#hud-fuel', this.root);
  private fuelBar = $('#hud-fuel-bar', this.root);
  private horizon = $('#hud-horizon', this.root);
  private nose = $('#hud-nose', this.root);
  private path = $('#hud-path', this.root);
  private noseNum = $('#hud-nose-num', this.root);
  private pathNum = $('#hud-path-num', this.root);
  private aoa = $('#hud-aoa', this.root);
  private aoaFill = $('#hud-aoa-fill', this.root);
  private aoaNum = $('#hud-aoa-num', this.root);
  private horn = $('#hud-horn', this.root);
  private progress = $('#hud-progress-fill', this.root);
  private marker = $('#hud-progress-panda', this.root);
  private best = $('#hud-progress-best', this.root);
  private toast = $('#toast');
  private cache = new Map<HTMLElement, string>();
  private toastTimer = 0;
  private features = new Set<SensorFeature>();

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Show only the readouts the flight's sensors provide. */
  configure(f: Flight): void {
    const has = (this.features = sensorFeatures(f.gear));
    this.speedChip.hidden = !has.has('speed');
    this.climb.hidden = !has.has('climb');
    this.altChip.hidden = !has.has('altitude') && !has.has('agl');
    this.altLabel.textContent = has.has('agl') ? 'Above ground' : 'Altitude';
    this.pitchChip.hidden = !has.has('pitch') || has.has('horizon');
    this.fuelWrap.hidden = !has.has('fuel') || f.maxFuel <= 0;
    this.horizon.hidden = !has.has('horizon');
    this.aoa.hidden = !has.has('aoa');
    this.horn.hidden = !has.has('stallHorn');
    this.cache.clear();
  }

  private set(el: HTMLElement, text: string): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    el.textContent = text;
  }

  private style(el: HTMLElement, prop: 'width' | 'left' | 'transform', value: string): void {
    const key = `${prop}:${value}`;
    if (this.cache.get(el) === key) return;
    this.cache.set(el, key);
    el.style[prop] = value;
  }

  private toggle(el: HTMLElement, cls: string, on: boolean): void {
    el.classList.toggle(cls, on);
  }

  update(f: Flight, bestDistance: number): void {
    const has = this.features;
    const flying = f.phase === 'air' && !f.onGround;
    this.set(this.dist, metres(f.distance));
    this.set(this.coins, money(f.coinMoney));

    if (has.has('speed')) this.set(this.speed, `${Math.round(f.speed * 3.6)} km/h`);
    if (has.has('climb')) {
      const vy = f.phase === 'air' ? f.vy : 0;
      const v = Math.round(vy);
      this.set(this.climb, v === 0 ? '— level' : `${v > 0 ? '▲' : '▼'} ${Math.abs(v)} m/s`);
      this.toggle(this.climb, 'sinking', v < -3);
    }

    const agl = Math.max(0, f.altitudeAboveGround - 0.45);
    if (has.has('agl')) this.set(this.alt, metres(agl));
    else if (has.has('altitude')) this.set(this.alt, metres(Math.max(0, f.y)));
    if (has.has('proximity')) {
      const danger = flying && agl < 25 && f.vy < -8;
      this.toggle(this.altChip, 'warn', danger);
      this.set(this.altLabel, danger ? 'TERRAIN!' : 'Above ground');
    }

    if (has.has('pitch')) this.set(this.pitch, signedDeg(f.pitch));
    if (has.has('horizon')) {
      const pathAngle = f.phase === 'air' ? Math.atan2(f.vy, f.vx) : f.pitch;
      this.style(this.nose, 'transform', `rotate(${(-deg(f.pitch)).toFixed(1)}deg)`);
      this.style(this.path, 'transform', `rotate(${(-deg(pathAngle)).toFixed(1)}deg)`);
      this.set(this.noseNum, signedDeg(f.pitch));
      this.set(this.pathNum, signedDeg(pathAngle));
    }

    const stallAngle = (f.gear.glider.stallDeg * Math.PI) / 180;
    if (has.has('aoa')) {
      const frac = flying ? Math.abs(f.angleOfAttack) / stallAngle : 0;
      this.style(this.aoaFill, 'width', `${(clamp(frac, 0, 1.2) / 1.2) * 100}%`);
      this.aoaFill.className = frac > 1 ? 'red' : frac > 0.75 ? 'amber' : '';
      const margin = Math.round(deg(stallAngle - Math.abs(f.angleOfAttack)));
      this.set(this.aoaNum, !flying ? '' : margin > 0 ? `${margin}°` : 'STALLED');
    }
    if (has.has('stallHorn')) this.toggle(this.horn, 'on', flying && f.stalled);

    if (has.has('fuel') && f.maxFuel > 0) this.style(this.fuelBar, 'width', `${((f.fuel / f.maxFuel) * 100).toFixed(1)}%`);

    const p = Math.min(1, f.distance / GOAL_DISTANCE);
    this.style(this.progress, 'width', `${(p * 100).toFixed(2)}%`);
    this.style(this.marker, 'left', `${(p * 100).toFixed(2)}%`);
    this.style(this.best, 'left', `${(Math.min(1, bestDistance / GOAL_DISTANCE) * 100).toFixed(2)}%`);
  }

  showToast(text: string, ms = 2200): void {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }
}
