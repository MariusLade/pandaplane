/**
 * Device-agnostic input. Game code only asks about *actions*; keyboards and
 * on-screen touch buttons both feed into the same action state, so adding
 * gamepad or tilt controls later means adding another source here.
 */
export type Action = 'up' | 'down' | 'boost' | 'fire' | 'confirm' | 'pause';

const KEYMAP: Record<string, Action[]> = {
  ArrowUp: ['up'],
  KeyW: ['up'],
  ArrowLeft: ['up'],
  KeyA: ['up'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  ArrowRight: ['down'],
  KeyD: ['down'],
  Space: ['boost', 'confirm'],
  ShiftLeft: ['boost'],
  ShiftRight: ['boost'],
  KeyX: ['boost'],
  KeyF: ['fire'],
  KeyJ: ['fire'],
  KeyK: ['fire'],
  ControlLeft: ['fire'],
  ControlRight: ['fire'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  Escape: ['pause'],
  KeyP: ['pause'],
};

export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number, Action>();
  private pressed = new Set<Action>();
  /** True once any touch has been seen; used to decide whether to show touch controls. */
  touchSeen = false;
  onFirstGesture: (() => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const actions = KEYMAP[e.code];
      if (!actions) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) for (const a of actions) this.pressed.add(a);
      this.keys.add(e.code);
      this.gesture();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.pointers.clear();
    });
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.touchSeen = true;
      this.gesture();
    });
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const cb = this.onFirstGesture;
      this.onFirstGesture = null;
      cb();
    }
  }

  /** Wire an on-screen button to an action (works for mouse, pen and multi-touch). */
  bindButton(el: HTMLElement, action: Action): void {
    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, action);
      this.pressed.add(action);
      el.classList.add('active');
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(action: Action): boolean {
    for (const code of this.keys) if (KEYMAP[code]?.includes(action)) return true;
    for (const a of this.pointers.values()) if (a === action) return true;
    return false;
  }

  /** Edge-triggered: true for one frame after the action was first pressed. */
  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Nose up = +1, nose down = -1. */
  get pitch(): number {
    return (this.isDown('up') ? 1 : 0) - (this.isDown('down') ? 1 : 0);
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
