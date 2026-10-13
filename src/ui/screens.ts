import { GOAL_DISTANCE } from '../game/constants';
import type { Earnings } from '../game/economy';
import type { SaveData } from '../game/save';
import { CATALOG, CATEGORIES, CATEGORY_LABEL, nextTier, type Category } from '../game/upgrades';
import { drawPreview } from '../render/preview';
import { $, h, metres, money } from './dom';

export interface ScreenActions {
  play(): void;
  newGame(): void;
  buy(category: Category): void;
  launch(): void;
  toTitle(): void;
  toggleMute(): void;
  resume(): void;
  endFlight(): void;
  continueFromResults(): void;
  continueFromVictory(): void;
  click(): void;
}

const isTouch = () => matchMedia('(pointer: coarse)').matches;

/** DOM overlay screens. Each `show*` replaces the overlay contents. */
export class Screens {
  private root = $('#screen');
  private previews: { canvas: HTMLCanvasElement; category: Category; tier: number }[] = [];
  private save: SaveData | null = null;

  constructor(private act: ScreenActions) {}

  hide(): void {
    this.root.replaceChildren();
    this.root.hidden = true;
    this.previews = [];
  }

  private mount(el: HTMLElement): void {
    this.root.replaceChildren(el);
    this.root.hidden = false;
    this.previews = [];
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.act.click()));
  }

  /** Animate preview canvases while the hangar is open. */
  tick(time: number): void {
    if (!this.save) return;
    for (const p of this.previews) drawPreview(p.canvas, p.category, p.tier, this.save.levels, time);
  }

  showTitle(hasSave: boolean, muted: boolean): void {
    const controls = isTouch()
      ? 'Hold <b>▲ ▼</b> to tilt, hold <b>BOOST</b> to fire the rocket.'
      : '<kbd>↑</kbd><kbd>↓</kbd> or <kbd>W</kbd><kbd>S</kbd> to tilt · <kbd>Space</kbd> to boost · <kbd>Esc</kbd> to pause';
    const el = h(`
      <div class="panel title-panel">
        <h1 class="logo">Panda<span>Plane</span></h1>
        <p class="tagline">One small panda. One very big sky.</p>
        <p class="story">Bamboo grows sweetest in <b>Panda Paradise</b>, ${metres(GOAL_DISTANCE)} beyond the mountains.
        Slide, glide and rocket your way there — earn cash every flight and upgrade your gear.</p>
        <div class="buttons">
          <button class="btn primary" data-a="play">${hasSave ? 'Continue' : 'Play'}</button>
          ${hasSave ? '<button class="btn" data-a="new">New game</button>' : ''}
          <button class="btn ghost" data-a="mute">${muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        </div>
        <p class="controls">${controls}</p>
      </div>`);
    el.querySelector('[data-a="play"]')!.addEventListener('click', () => this.act.play());
    el.querySelector('[data-a="new"]')?.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      if (b.dataset.confirm) this.act.newGame();
      else {
        b.dataset.confirm = '1';
        b.textContent = 'Really? Tap again';
      }
    });
    el.querySelector('[data-a="mute"]')!.addEventListener('click', (e) => {
      this.act.toggleMute();
      (e.currentTarget as HTMLElement).textContent = muted ? '🔊 Sound on' : '🔇 Sound off';
      muted = !muted;
    });
    this.mount(el);
  }

  showHangar(save: SaveData): void {
    this.save = save;
    const progress = Math.min(1, save.best.distance / GOAL_DISTANCE);
    const el = h(`
      <div class="hangar">
        <header class="bar">
          <button class="btn icon" data-a="menu" aria-label="Menu">☰</button>
          <div class="stat"><small>Day</small><b>${save.day}</b></div>
          <div class="stat money"><small>Cash</small><b>${money(save.money)}</b></div>
          <div class="stat"><small>Best</small><b>${metres(save.best.distance)}</b></div>
        </header>
        <div class="goal">
          <div class="goal-track"><div class="goal-fill" style="width:${(progress * 100).toFixed(1)}%"></div></div>
          <span>${save.goalReached ? '🎋 Panda Paradise reached!' : `${Math.round(progress * 100)}% of the way to Panda Paradise`}</span>
        </div>
        <div class="cards"></div>
        <footer class="launch-bar">
          <button class="btn primary big" data-a="launch">Launch! 🐼</button>
        </footer>
      </div>`);
    const cards = el.querySelector('.cards')!;
    for (const cat of CATEGORIES) {
      const level = save.levels[cat];
      const tiers = CATALOG[cat];
      const next = nextTier(cat, save.levels);
      const current = tiers[level];
      const pips = tiers.map((_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('');
      const affordable = next ? save.money >= next.cost : false;
      const card = h(`
        <article class="card ${next ? '' : 'maxed'}">
          <div class="card-head"><h3>${CATEGORY_LABEL[cat]}</h3><div class="pips">${pips}</div></div>
          <canvas class="preview"></canvas>
          <div class="current">Now: <b>${current.name}</b></div>
          ${
            next
              ? `<div class="next"><b>${next.name}</b><span>${next.blurb}</span></div>
                 <button class="btn buy ${affordable ? '' : 'disabled'}" data-cat="${cat}">Buy ${money(next.cost)}</button>`
              : `<div class="next"><span>${current.blurb}</span></div><button class="btn buy disabled" disabled>Maxed out</button>`
          }
        </article>`);
      card.querySelector('[data-cat]')?.addEventListener('click', () => this.act.buy(cat));
      cards.appendChild(card);
      this.previews.push({ canvas: card.querySelector('canvas')!, category: cat, tier: next ? level + 1 : level });
    }
    el.querySelector('[data-a="launch"]')!.addEventListener('click', () => this.act.launch());
    el.querySelector('[data-a="menu"]')!.addEventListener('click', () => this.act.toTitle());
    const previews = this.previews;
    this.mount(el);
    this.previews = previews;
  }

  showResults(day: number, earnings: Earnings, onDone: () => void): void {
    const rows = earnings.lines
      .map(
        (l, i) =>
          `<li style="animation-delay:${i * 0.12}s"><span>${l.label}</span><em>${l.detail}</em><b>+${money(l.amount)}</b></li>`,
      )
      .join('');
    const badges = earnings.newRecords
      .map((r) => `<span class="badge">New ${r === 'airtime' ? 'air time' : r} record!</span>`)
      .join('');
    const el = h(`
      <div class="panel results">
        <h2>Day ${day} — flight report</h2>
        <ul class="lines">${rows}</ul>
        <div class="badges">${badges}</div>
        <div class="total"><span>Total</span><b data-total>$0</b></div>
        <button class="btn primary big" data-a="next">Back to the hangar</button>
      </div>`);
    const total = el.querySelector<HTMLElement>('[data-total]')!;
    const start = performance.now();
    const delay = earnings.lines.length * 120;
    const anim = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / 700));
      total.textContent = money(earnings.total * t);
      if (t < 1 && el.isConnected) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
    el.querySelector('[data-a="next"]')!.addEventListener('click', () => this.act.continueFromResults());
    this.mount(el);
    window.setTimeout(onDone, delay + 200);
  }

  showVictory(day: number): void {
    const el = h(`
      <div class="panel victory">
        <h2>🎋 Panda Paradise! 🎋</h2>
        <p>After <b>${day}</b> day${day === 1 ? '' : 's'} of training, our panda finally made it to the sweetest bamboo in the world.</p>
        <p>The sky is still big, though. Keep flying for new records!</p>
        <button class="btn primary big" data-a="ok">Keep flying</button>
      </div>`);
    el.querySelector('[data-a="ok"]')!.addEventListener('click', () => this.act.continueFromVictory());
    this.mount(el);
  }

  showPause(): void {
    const el = h(`
      <div class="panel pause">
        <h2>Paused</h2>
        <div class="buttons">
          <button class="btn primary" data-a="resume">Resume</button>
          <button class="btn" data-a="end">End flight</button>
        </div>
      </div>`);
    el.querySelector('[data-a="resume"]')!.addEventListener('click', () => this.act.resume());
    el.querySelector('[data-a="end"]')!.addEventListener('click', () => this.act.endFlight());
    this.mount(el);
  }
}
