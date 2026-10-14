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
  private ammoChip = $('#hud-ammo-chip', this.root);
  private ammo = $('#hud-ammo', this.root);
  private shieldChip = $('#hud-shield-chip', this.root);
  private shield = $('#hud-shield', this.root);
  private killsChip = $('#hud-kills-chip', this.root);
  private kills = $('#hud-kills', this.root);
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
    this.ammoChip.hidden = f.gear.weapon.rate <= 0;
    this.shieldChip.hidden = f.shield <= 0;
    this.killsChip.hidden = f.gear.weapon.rate <= 0;
    $('.hud-goal').textContent = f.world.map.icon;
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
    if (f.gear.weapon.rate > 0) {
      this.set(this.ammo, `× ${f.ammo}`);
      this.set(this.kills, `${f.kills}`);
    }
    if (!this.shieldChip.hidden) this.set(this.shield, f.shield > 0 ? `× ${f.shield}` : 'popped');
    const goal = f.world.map.goal;
    const p = Math.min(1, f.distance / goal);
    this.style(this.progress, 'width', `${(p * 100).toFixed(2)}%`);
    this.style(this.marker, 'left', `${(p * 100).toFixed(2)}%`);
    this.style(this.best, 'left', `${(Math.min(1, bestDistance / goal) * 100).toFixed(2)}%`);
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
