import type { Earnings } from '../game/economy';
import { MAPS, MAP_ORDER } from '../game/maps';
import type { SaveData } from '../game/save';
import { STATS, buildSummary, statMax } from '../game/stats';
import {
  CATALOG,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  SENSOR_FEATURE_LABEL,
  SENSOR_SLOT_LABEL,
  MAX_GADGETS,
  SHOP_CATEGORIES,
  SHOP_UNLOCK,
  itemUnlocked,
  loadoutFor,
  sensorConflicts,
  type Category,
  type Item,
  type Loadout,
  type SensorItem,
  type ShopCategory,
} from '../game/upgrades';
import { drawPanda } from '../render/panda';
import { drawGadgetRack, drawItemPreview, drawSensorRack } from '../render/preview';
import { $, h, metres, money } from './dom';

export interface ScreenActions {
  play(): void;
  newGame(): void;
  openShop(category: ShopCategory): void;
  closeShop(): void;
  buy(category: ShopCategory, id: string): void;
  equip(category: ShopCategory, id: string): void;
  unequip(category: ShopCategory, id: string): void;
  switchMap(): void;
  launch(): void;
  toTitle(): void;
  toggleMute(): void;
  resume(): void;
  endFlight(): void;
  continueFromResults(): void;
  continueFromVictory(): void;
  click(): void;
}

interface Preview {
  canvas: HTMLCanvasElement;
  draw(time: number): void;
}

const isTouch = () => matchMedia('(pointer: coarse)').matches;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Splits a word into bouncing letters. */
const bouncy = (text: string, offset = 0) =>
  [...text].map((ch, i) => `<span style="animation-delay:${(i + offset) * 0.07}s">${ch}</span>`).join('');

/** DOM overlay screens. Each `show*` replaces the overlay contents. */
export class Screens {
  private root = $('#screen');
  private previews: Preview[] = [];

  constructor(private act: ScreenActions) {
    // Tapping anywhere on the results / victory screen (except a button) advances.
    this.root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (this.root.querySelector('.results, .victory')) this.advance();
    });
  }

  hide(): void {
    this.root.replaceChildren();
    this.root.hidden = true;
    this.root.className = '';
    this.previews = [];
  }

  private mount(el: HTMLElement, backdrop = ''): void {
    this.skipResults = null;
    this.root.replaceChildren(el);
    this.root.hidden = false;
    this.root.className = backdrop;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.act.click()));
  }

  /** Animate preview canvases while a menu is open. */
  tick(time: number): void {
    for (const p of this.previews) if (p.canvas.isConnected) p.draw(time);
  }

  private mascot(canvas: HTMLCanvasElement, gear: Loadout): Preview {
    return {
      canvas,
      draw: (time) => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth || 200;
        const ht = canvas.clientHeight || 160;
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(ht * dpr);
        }
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, ht);
        const hasWing = gear.glider.style !== 'none';
        const span = hasWing ? gear.glider.span * 0.5 + 1.8 : 2.6;
        const scale = Math.min((w * 0.8) / span, ht / (hasWing ? 2.5 : 1.9));
        const bob = Math.sin(time * 2.2) * 3;
        drawPanda(ctx, w / 2, ht * (hasWing ? 0.66 : 0.58) + bob, scale, gear, {
          angle: 0.06 + Math.sin(time * 1.3) * 0.04,
          time,
          speed: 8,
          boosting: false,
          mood: Math.sin(time * 0.4) > 0.97 ? 'sleepy' : 'happy',
          wind: 0.4,
        });
      },
    };
  }

  showTitle(hasSave: boolean, muted: boolean): void {
    const controls = isTouch()
      ? 'Hold <b>▲ ▼</b> to tilt, hold <b>BOOST</b> to fire the rocket.'
      : '<kbd>↑</kbd><kbd>↓</kbd> or <kbd>W</kbd><kbd>S</kbd> tilt · <kbd>Space</kbd> boost · <kbd>Esc</kbd> pause';
    const el = h(`
      <div class="paper title-panel">
        <h1 class="logo"><span class="w1">${bouncy('Panda')}</span><span class="w2">${bouncy('Plane', 5)}</span></h1>
        <p class="tagline">One small panda. One very big sky.</p>
        <p class="story">Bamboo grows sweetest in <b>Panda Paradise</b>, ${metres(MAPS.valley.goal)} past the mountains.
        Slide, glide and rocket your way there. Earn cash every flight and build the perfect flying machine.</p>
        <div class="buttons">
          <button class="btn primary big" data-a="play">${hasSave ? 'Keep flying!' : "Let's fly!"}</button>
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
        b.textContent = 'Erase save? Tap again';
        b.classList.add('danger');
      }
    });
    el.querySelector('[data-a="mute"]')!.addEventListener('click', (e) => {
      this.act.toggleMute();
      muted = !muted;
      (e.currentTarget as HTMLElement).textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    });
    this.mount(el, 'title-bg');
    this.previews = [];
  }

  private header(save: SaveData, left: string): string {
    return `
      <header class="sign">
        ${left}
        <div class="chip day"><small>Day</small><b>${save.day}</b></div>
        <div class="chip cash"><small>Bamboo bucks</small><b>${money(save.money)}</b></div>
        <div class="chip best"><small>Best</small><b>${metres(save.progress[save.map].best.distance)}</b></div>
      </header>`;
  }

  showHangar(save: SaveData, says: string): void {
    const gear = loadoutFor(save.equipped, save.sensors, save.gadgets);
    const sum = buildSummary(gear);
    const map = MAPS[save.map];
    const prog = save.progress[save.map];
    const progress = Math.min(1, prog.best.distance / map.goal);
    const tiles = SHOP_CATEGORIES.map((c) => {
      const needs = SHOP_UNLOCK[c];
      if (needs && !save.unlocked.includes(needs)) {
        return `
        <div class="tile locked">
          <span class="tile-head"><span class="icon">${CATEGORY_ICON[c]}</span>${CATEGORY_LABEL[c]}</span>
          <span class="lock-art">🔒</span>
          <span class="tile-item">Reach ${MAPS.valley.goalName}</span>
          <span class="tile-foot">Unlocks with ${MAPS[needs].name}</span>
        </div>`;
      }
      const multi = c === 'sensor' ? gear.sensors : c === 'gadget' ? gear.gadgets : null;
      const label = multi ? (multi.length ? `${multi.length} equipped` : 'None equipped') : (gear[c as Category] as Item).name;
      const owned = save.owned[c].length;
      const total = CATALOG[c].length;
      const affordable = (CATALOG[c] as Item[]).some(
        (i) => !save.owned[c].includes(i.id) && i.cost <= save.money && itemUnlocked(i, save.unlocked),
      );
      return `
        <button class="tile" data-shop="${c}">
          <span class="tile-head"><span class="icon">${CATEGORY_ICON[c]}</span>${CATEGORY_LABEL[c]}
            ${affordable ? '<span class="new-badge">NEW!</span>' : ''}</span>
          <canvas class="preview" data-cat="${c}"></canvas>
          <span class="tile-item">${escape(label)}</span>
          <span class="tile-foot">${owned}/${total} owned <span class="go">Shop ›</span></span>
        </button>`;
    }).join('');
    const mapButton =
      save.unlocked.length > 1
        ? `<button class="btn map-switch" data-a="map" title="Switch map">🗺️ ${escape(map.name)} <span>⇄</span></button>`
        : `<span class="map-name">🗺️ ${escape(map.name)}</span>`;
    const el = h(`
      <div class="hangar map-${map.id}">
        ${this.header(save, '<button class="btn icon" data-a="menu" aria-label="Menu">☰</button><h2 class="sign-title">The Hangar</h2>')}
        <div class="goal">
          ${mapButton}
          <span>🐼</span>
          <div class="goal-track"><div class="goal-fill" style="width:${(progress * 100).toFixed(1)}%"></div></div>
          <span>${map.icon}</span>
          <em>${prog.goalReached ? `${map.goalName} reached!` : `${Math.round(progress * 100)}% to ${map.goalName}`}</em>
        </div>
        <div class="hangar-body">
          <section class="paper mascot">
            <div class="bubble">${escape(says)}</div>
            <canvas class="mascot-canvas"></canvas>
            <dl class="build">
              <div><dt>Weight</dt><dd>${Math.round(sum.mass)} kg</dd></div>
              <div><dt>Launch</dt><dd>${Math.round(sum.launch * 3.6)} km/h</dd></div>
              <div><dt>Glide</dt><dd>${sum.glide > 0 ? `${sum.glide.toFixed(1)}:1` : '—'}</dd></div>
              <div><dt>Boost</dt><dd>${sum.boost > 0 ? `${sum.boost.toFixed(1)} s` : '—'}</dd></div>
            </dl>
          </section>
          <section class="tiles">${tiles}</section>
        </div>
        <footer class="launch-bar">
          <button class="btn primary big launch" data-a="launch">Launch! <span class="wiggle">🚀</span></button>
        </footer>
      </div>`);
    const previews: Preview[] = [this.mascot(el.querySelector<HTMLCanvasElement>('.mascot-canvas')!, gear)];
    el.querySelectorAll<HTMLCanvasElement>('canvas[data-cat]').forEach((canvas) => {
      const c = canvas.dataset.cat as ShopCategory;
      previews.push({
        canvas,
        draw: (t) =>
          c === 'sensor'
            ? drawSensorRack(canvas, gear.sensors, t)
            : c === 'gadget'
              ? drawGadgetRack(canvas, gear.gadgets, t)
              : drawItemPreview(canvas, c, gear[c as Category] as Item, gear, t),
      });
    });
    el.querySelectorAll<HTMLElement>('[data-shop]').forEach((b) =>
      b.addEventListener('click', () => this.act.openShop(b.dataset.shop as ShopCategory)),
    );
    el.querySelector('[data-a="launch"]')!.addEventListener('click', () => this.act.launch());
    el.querySelector('[data-a="menu"]')!.addEventListener('click', () => this.act.toTitle());
    el.querySelector('[data-a="map"]')?.addEventListener('click', () => this.act.switchMap());
    this.mount(el, 'menu-bg');
    this.previews = previews;
  }

  showShop(save: SaveData, category: ShopCategory, says: string): void {
    const gear = loadoutFor(save.equipped, save.sensors, save.gadgets);
    const isSensor = category === 'sensor';
    const isGadget = category === 'gadget';
    const multi = isSensor || isGadget;
    // Multi-equip shops have no single "equipped" item to compare against.
    const equipped = multi ? null : (gear[category as Category] as Item);
    const stats = STATS[category];
    const maxes = stats.map((s) => statMax(category, s, gear));
    const items = CATALOG[category] as Item[];
    const cards = items
      .map((item) => {
        const owned = save.owned[category].includes(item.id);
        const isEquipped = isSensor
          ? save.sensors.includes(item.id)
          : isGadget
            ? save.gadgets.includes(item.id)
            : item.id === equipped!.id;
        const locked = !itemUnlocked(item, save.unlocked);
        const rows = stats
          .map((s, si) => {
            const v = s.value(item, gear);
            const cur = equipped ? s.value(equipped, gear) : v;
            const pct = Math.max(2, Math.min(100, (v / maxes[si]) * 100));
            let delta = '';
            if (!isEquipped && Math.abs(v - cur) > 1e-6) {
              const up = v > cur;
              const good = s.better === 'none' ? 'neutral' : (s.better === 'higher') === up ? 'good' : 'bad';
              delta = `<i class="delta ${good}">${up ? '▲' : '▼'}</i>`;
            }
            return `<div class="stat" title="${escape(s.hint)}">
              <span class="stat-label">${s.label}</span>
              <span class="bar ${s.better === 'none' ? 'neutral' : ''}"><span style="width:${pct.toFixed(1)}%"></span></span>
              <span class="stat-value">${s.format(v)}${delta}</span>
            </div>`;
          })
          .join('');
        const afford = save.money >= item.cost;
        const action = locked
          ? `<button class="btn buy disabled" disabled>🔒 ${escape(MAPS[item.unlock!].name)}</button>`
          : isEquipped
            ? multi
              ? `<button class="btn equip on" data-unequip="${item.id}">Equipped ✓ <small>(remove)</small></button>`
              : '<button class="btn equip on" disabled>Equipped ✓</button>'
            : owned
              ? `<button class="btn equip" data-equip="${item.id}">Equip</button>`
              : `<button class="btn buy ${afford ? '' : 'disabled'}" data-buy="${item.id}">Buy ${money(item.cost)}</button>`;
        const sensorInfo = isSensor ? this.sensorInfo(item as SensorItem, save.sensors, isEquipped) : '';
        const gadgetInfo =
          isGadget && !isEquipped && save.gadgets.length >= MAX_GADGETS
            ? `<p class="replaces">Replaces ${escape(CATALOG.gadget.find((g) => g.id === save.gadgets[0])?.name ?? '')}</p>`
            : '';
        const tag = locked
          ? '<span class="sticker lock">Locked</span>'
          : owned
            ? '<span class="sticker">Owned</span>'
            : `<span class="price-tag">${item.cost ? money(item.cost) : 'Free'}</span>`;
        return `
          <article class="paper item ${isEquipped ? 'is-equipped' : ''} ${owned ? 'is-owned' : ''} ${locked ? 'is-locked' : ''}">
            ${tag}
            <canvas class="preview" data-item="${item.id}"></canvas>
            <h3>${escape(item.name)}</h3>
            ${item.perk ? `<span class="perk">✨ ${escape(item.perk)}</span>` : ''}
            <p class="blurb">${escape(item.blurb)}</p>
            ${sensorInfo}${gadgetInfo}
            <div class="stats">${rows}</div>
            ${action}
          </article>`;
      })
      .join('');
    const el = h(`
      <div class="shop">
        ${this.header(save, `<button class="btn icon back" data-a="back">‹ Hangar</button><h2 class="sign-title"><span class="icon">${CATEGORY_ICON[category]}</span> ${CATEGORY_LABEL[category]}</h2>`)}
        <div class="shop-says"><span class="mini-panda">🐼</span><div class="bubble left">${escape(says)}</div></div>
        ${isSensor ? '<p class="shop-note">Equip as many instruments as you like, but only one per slot. Without one, that reading stays hidden in flight.</p>' : ''}
        ${isGadget ? `<p class="shop-note">Wear up to ${MAX_GADGETS} gadgets at once.</p>` : ''}
        ${category === 'weapon' ? `<p class="shop-note">Hold <b>${isTouch() ? 'FIRE' : 'F'}</b> to shoot where your nose points. Enemies show up in ${MAPS.canyon.name} and ${MAPS.storm.name}.</p>` : ''}
        <div class="items">${cards}</div>
      </div>`);
    const previews: Preview[] = [];
    el.querySelectorAll<HTMLCanvasElement>('canvas[data-item]').forEach((canvas) => {
      const item = items.find((i) => i.id === canvas.dataset.item)!;
      previews.push({ canvas, draw: (t) => drawItemPreview(canvas, category, item, gear, t) });
    });
    el.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => this.act.buy(category, b.dataset.buy!)),
    );
    el.querySelectorAll<HTMLElement>('[data-equip]').forEach((b) =>
      b.addEventListener('click', () => this.act.equip(category, b.dataset.equip!)),
    );
    el.querySelectorAll<HTMLElement>('[data-unequip]').forEach((b) =>
      b.addEventListener('click', () => this.act.unequip(category, b.dataset.unequip!)),
    );
    el.querySelector('[data-a="back"]')!.addEventListener('click', () => this.act.closeShop());
    const scroll = this.root.querySelector('.items')?.scrollTop ?? 0;
    this.mount(el, 'menu-bg');
    el.querySelector('.items')!.scrollTop = scroll;
    this.previews = previews;
  }

  /** What a sensor shows, which slots it uses and what it would replace. */
  private sensorInfo(item: SensorItem, equipped: string[], isEquipped: boolean): string {
    const shows = item.features.map((f) => `<span class="feature">✔ ${SENSOR_FEATURE_LABEL[f]}</span>`).join('');
    const slots = item.slots.map((sl) => `<span class="slot">${SENSOR_SLOT_LABEL[sl]}</span>`).join('');
    const clashes = sensorConflicts(item).filter((c) => equipped.includes(c.id));
    const note =
      !isEquipped && clashes.length
        ? `<p class="replaces">Replaces ${clashes.map((c) => escape(c.name)).join(' & ')}</p>`
        : '';
    return `<div class="features">${shows}</div><div class="slots">Slot${item.slots.length > 1 ? 's' : ''}: ${slots}</div>${note}`;
  }

  /** True when the hangar (not a shop) is on screen. */
  inHangar(): boolean {
    return !!this.root.querySelector('.hangar');
  }

  /** Finishes the results animation, if one is playing. Returns false when there was nothing to skip. */
  private skipResults: (() => boolean) | null = null;

  /** Space / Enter / tap on the results: first finish the animation, then continue. */
  advance(): void {
    if (this.skipResults?.()) return;
    if (this.root.querySelector('.results')) this.act.continueFromResults();
    else if (this.root.querySelector('.victory')) this.act.continueFromVictory();
  }

  showResults(day: number, mapName: string, earnings: Earnings, says: string, onDone: () => void): void {
    const rows = earnings.lines
      .map(
        (l, i) =>
          `<li style="animation-delay:${0.05 + i * 0.07}s"><span>${l.label}</span><em>${l.detail}</em><b>+${money(l.amount)}</b></li>`,
      )
      .join('');
    const stamps = earnings.newRecords
      .map(
        (r, i) =>
          `<span class="stamp" style="--r:${(i % 2 ? 1 : -1) * (4 + i * 3)}deg;animation-delay:${0.45 + i * 0.12}s">New ${r === 'airtime' ? 'air time' : r} record!</span>`,
      )
      .join('');
    const hint = isTouch() ? 'Tap anywhere to continue' : 'Press Space to continue';
    const el = h(`
      <div class="notebook results">
        <h2>Flight log <small>Day ${day} · ${escape(mapName)}</small></h2>
        <ul class="lines">${rows}</ul>
        <div class="stamps">${stamps}</div>
        <div class="total"><span>Total earned</span><b data-total>$0</b></div>
        <div class="results-says"><span class="mini-panda">🐼</span><div class="bubble left">${escape(says)}</div></div>
        <button class="btn primary big" data-a="next">Back to the hangar</button>
        <p class="skip-hint">${hint}</p>
      </div>`);
    const total = el.querySelector<HTMLElement>('[data-total]')!;
    const start = performance.now();
    const delay = 50 + earnings.lines.length * 70;
    const COUNT_MS = 450;
    let done = false;
    let paid = false;
    const pay = () => {
      if (!paid) {
        paid = true;
        onDone();
      }
    };
    const finish = () => {
      done = true;
      total.textContent = money(earnings.total);
      el.classList.add('instant');
      pay();
    };
    const anim = (now: number) => {
      if (done || !el.isConnected) return;
      const t = Math.min(1, Math.max(0, (now - start - delay) / COUNT_MS));
      total.textContent = money(earnings.total * t);
      if (t > 0) pay();
      if (t < 1) requestAnimationFrame(anim);
      else done = true;
    };
    requestAnimationFrame(anim);
    el.querySelector('[data-a="next"]')!.addEventListener('click', () => this.act.continueFromResults());
    this.mount(el, 'dim-bg');
    this.previews = [];
    this.skipResults = () => {
      // Stamps keep animating a little after the count; treat the whole thing as one.
      const playing = !done || performance.now() - start < 450 + earnings.newRecords.length * 120 + 350;
      if (!playing || el.classList.contains('instant')) return false;
      finish();
      return true;
    };
  }

  showVictory(day: number, mapId: SaveData['map'], unlockedName: string | null): void {
    const map = MAPS[mapId];
    const story = `our panda ${map.story}`;
    const next = MAP_ORDER[MAP_ORDER.indexOf(mapId) + 1];
    const note = next ? MAPS[next].unlockNote : '';
    const unlock = unlockedName
      ? `<p class="unlock-banner">🔓 New map unlocked: <b>${escape(unlockedName)}</b>!${note ? `<br><small>${escape(note)}</small>` : ''}</p>`
      : '<p>The sky is still big, though. Keep flying for new records!</p>';
    const el = h(`
      <div class="paper victory">
        <div class="confetti-row">${map.icon}🐼${map.icon}</div>
        <h2>${escape(map.goalName)}!</h2>
        <p>After <b>${day}</b> day${day === 1 ? '' : 's'} of slides, glides and questionable rockets, ${story}</p>
        ${unlock}
        <button class="btn primary big" data-a="ok">Keep flying</button>
      </div>`);
    el.querySelector('[data-a="ok"]')!.addEventListener('click', () => this.act.continueFromVictory());
    this.mount(el, 'dim-bg');
    this.previews = [];
  }

  showPause(): void {
    const el = h(`
      <div class="paper pause">
        <h2>Paused</h2>
        <p class="tagline">The panda is having a quick snack.</p>
        <div class="buttons">
          <button class="btn primary" data-a="resume">Resume</button>
          <button class="btn" data-a="end">End flight</button>
        </div>
      </div>`);
    el.querySelector('[data-a="resume"]')!.addEventListener('click', () => this.act.resume());
    el.querySelector('[data-a="end"]')!.addEventListener('click', () => this.act.endFlight());
    this.mount(el, 'dim-bg');
    this.previews = [];
  }
}
