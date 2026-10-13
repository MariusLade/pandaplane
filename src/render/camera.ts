import { clamp, damp } from '../core/math';

/**
 * World <-> screen transform. World units are metres with +y up; screen units
 * are CSS pixels with +y down. `span` is how many metres fit across the
 * limiting screen dimension, so portrait phones and wide monitors both work.
 */
export class Camera {
  x = 0;
  y = 0;
  span = 50;
  w = 1;
  h = 1;
  shake = 0;
  private shakeX = 0;
  private shakeY = 0;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  get ppm(): number {
    return Math.min(this.w, this.h * 1.6) / this.span;
  }

  get viewWidth(): number {
    return this.w / this.ppm;
  }

  get viewHeight(): number {
    return this.h / this.ppm;
  }

  sx(wx: number): number {
    return (wx - this.x) * this.ppm + this.w / 2 + this.shakeX;
  }

  sy(wy: number): number {
    return this.h / 2 - (wy - this.y) * this.ppm + this.shakeY;
  }

  wx(sx: number): number {
    return (sx - this.w / 2) / this.ppm + this.x;
  }

  wy(sy: number): number {
    return (this.h / 2 - sy) / this.ppm + this.y;
  }

  /**
   * Ease towards a target. `groundY` keeps the ground in the lower part of the
   * screen while flying low.
   */
  follow(tx: number, ty: number, span: number, groundY: number, dt: number, snap = false): void {
    const rate = snap ? 1e9 : 5;
    this.span = snap ? span : damp(this.span, span, 1.6, dt);
    const viewH = this.viewHeight;
    const minY = groundY + viewH * 0.28;
    this.x = damp(this.x, tx, rate, dt);
    this.y = damp(this.y, Math.max(ty, minY), rate, dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const s = this.shake * this.shake * 14;
    this.shakeX = (Math.random() - 0.5) * s;
    this.shakeY = (Math.random() - 0.5) * s;
  }

  addShake(amount: number): void {
    this.shake = clamp(Math.max(this.shake, amount), 0, 1);
  }
}
