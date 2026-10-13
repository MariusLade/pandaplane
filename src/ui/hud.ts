import { GOAL_DISTANCE } from '../game/constants';
import type { Flight } from '../game/flight';
import { $, metres, money } from './dom';

/**
 * In-flight heads-up display: distance, coins, flaps and goal progress. Sensor
 * readouts live on the instrument panel (see instruments.ts). Only touches the
 * DOM when a value changes.
 */
export class Hud {
  private root = $('#hud');
  private dist = $('#hud-dist', this.root);
  private coins = $('#hud-coins', this.root);
  private flapsChip = $('#hud-flaps-chip', this.root);
  private flaps = $('#hud-flaps', this.root);
  private progress = $('#hud-progress-fill', this.root);
  private marker = $('#hud-progress-panda', this.root);
  private best = $('#hud-progress-best', this.root);
  private toast = $('#toast');
  private cache = new Map<HTMLElement, string>();
  private toastTimer = 0;

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  configure(f: Flight): void {
    this.flapsChip.hidden = !f.gear.glider.flaps;
    this.cache.clear();
  }

  private set(el: HTMLElement, text: string): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    el.textContent = text;
  }

  private style(el: HTMLElement, prop: 'width' | 'left', value: string): void {
    const key = `${prop}:${value}`;
    if (this.cache.get(el) === key) return;
    this.cache.set(el, key);
    el.style[prop] = value;
  }

  update(f: Flight, bestDistance: number): void {
    this.set(this.dist, metres(f.distance));
    this.set(this.coins, money(f.coinMoney));
    if (f.gear.glider.flaps) this.set(this.flaps, `× ${f.flapsLeft}`);
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
