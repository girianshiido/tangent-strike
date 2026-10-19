import { BOUNDS, derivative, format, movingObstacle, movingTarget, projection, resistance, value, type Level, type Point, type ShotResult } from './engine.js';
export interface BoardState { level: Level; destroyed: Set<number>; damage: Map<number, number>; time: number; aim: number | null; shot: {result: ShotResult; at: number} | null; hint: number | null; reducedMotion: boolean }
export const shotDuration = (reducedMotion: boolean) => reducedMotion ? 300 : 1400;
export class Board {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private w = 0; private h = 0; private ratio = 1; private scale = 1;
  private center = {x: 0, y: 0};
  private previousLevel: Level | null = null;
  constructor(public canvas: HTMLCanvasElement, private getState: () => BoardState, private onResize: () => void) {
    this.ctx = canvas.getContext('2d', {alpha: false})!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (rect.width === this.w && rect.height === this.h && ratio === this.ratio) return;
    this.w = rect.width; this.h = rect.height; this.ratio = ratio;
    const width = Math.round(this.w * this.ratio), height = Math.round(this.h * this.ratio);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.previousLevel = this.getState().level;
    this.updateProjection();
    this.drawBackground();
    // ResizeObserver runs after animation callbacks, just before presentation.
    // Resizing clears the bitmap: repaint now rather than exposing a blank frame.
    this.draw(performance.now());this.onResize();
  }
  private updateProjection() {
    const p = projection(this.getState().level, this.w, this.h);
    this.scale = p.scale;this.center = p.center;
  }
  screen(p: Point): Point { return {x: this.center.x + p.x * this.scale, y: this.center.y - p.y * this.scale}; }
  math(p: Point): Point { return {x: (p.x - this.center.x) / this.scale, y: (this.center.y - p.y) / this.scale}; }
  nearest(clientX: number, clientY: number): {a: number; distance: number} {
    const rect = this.canvas.getBoundingClientRect(), p = {x: clientX - rect.left, y: clientY - rect.top};
    const c = this.getState().level.curve;
    let a = 0, best = Infinity;
    for (let x = BOUNDS.left + .15; x <= BOUNDS.right - .15; x += .025) {
      const q = this.screen({x, y: value(c, x)}), dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < best) {a = x; best = dist;}
    }
    return {a: Math.round(a * 40) / 40, distance: best};
  }
  private drawBackground() {
    this.background.width = this.canvas.width; this.background.height = this.canvas.height;
    const c = this.background.getContext('2d')!;
    c.scale(this.ratio, this.ratio); c.fillStyle = '#12212b'; c.fillRect(0, 0, this.w, this.h);
    const gradient = c.createRadialGradient(this.center.x, this.center.y, 0, this.center.x, this.center.y, this.w * .65);
    gradient.addColorStop(0, '#1b35403b'); gradient.addColorStop(1, '#12212b00');c.fillStyle = gradient;c.fillRect(0, 0, this.w, this.h);
    const p = projection(this.getState().level, this.w, this.h);
    const low = {x: this.screen({x: BOUNDS.left, y: 0}).x, y: this.h - p.bottom};
    const high = {x: this.screen({x: BOUNDS.right, y: 0}).x, y: p.top};
    const minY = (this.center.y - low.y) / this.scale, maxY = (this.center.y - high.y) / this.scale;
    c.save();c.beginPath();c.rect(6, p.top - 12, this.w - 12, this.h - p.top - p.bottom + 18);c.clip();
    c.lineWidth = 1;
    for (let x = -5; x <= 5; x++) {
      const p = this.screen({x, y: 0}); c.strokeStyle = x === 0 ? '#536775' : '#263d48';
      c.beginPath(); c.moveTo(p.x, high.y); c.lineTo(p.x, low.y); c.stroke();
      if (x && (this.scale > 29 || x % 2 === 0)) {c.fillStyle = '#6d8593'; c.font = '9px ui-monospace,monospace'; c.textAlign = 'center';c.fillText(String(x).replace('-', '−'), p.x, this.center.y + 15);}
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const p = this.screen({x: 0, y});c.strokeStyle = y === 0 ? '#536775' : '#263d48';c.beginPath();c.moveTo(low.x, p.y);c.lineTo(high.x, p.y);c.stroke();
      if (y && (this.scale > 29 || y % 2 === 0)) {c.fillStyle = '#6d8593';c.font = '9px ui-monospace,monospace';c.textAlign = 'right';c.fillText(String(y).replace('-', '−'), this.center.x - 9, p.y + 3);}
    }
    c.fillStyle = '#93a8b2';c.font = 'italic 11px Georgia,serif';c.textAlign = 'center';c.fillText('x', high.x + 9, this.center.y + 4);c.fillText('y', this.center.x, high.y - 10);
    c.font = '9px ui-monospace,monospace';c.fillStyle = '#6d8593';c.fillText('0', this.center.x - 10, this.center.y + 15);
    c.strokeStyle = '#536775';c.beginPath();c.moveTo(high.x - 4, this.center.y - 3);c.lineTo(high.x + 1, this.center.y);c.lineTo(high.x - 4, this.center.y + 3);c.moveTo(this.center.x - 3, high.y + 4);c.lineTo(this.center.x, high.y - 1);c.lineTo(this.center.x + 3, high.y + 4);c.stroke();
    c.restore();
  }
  draw(now: number) {
    const c = this.ctx, state = this.getState(), level = state.level;
    // Expose the rendered simulation clock for deterministic canvas QA.
    this.canvas.dataset.time = state.time.toFixed(3);
    if (level !== this.previousLevel) {this.previousLevel = level;this.updateProjection();this.drawBackground();}
    const tip = document.getElementById('first-tip');
    if (tip && !tip.hidden) {
      const p = this.screen({x: level.solution, y: value(level.curve, level.solution)});
      tip.style.left = `${p.x}px`;tip.style.top = `${p.y}px`;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);c.drawImage(this.background, 0, 0);c.scale(this.ratio, this.ratio);
    c.save();c.beginPath();c.rect(12, this.h < 350 ? 30 : 49, this.w - 24, this.h - (this.h < 350 ? 51 : 79));c.clip();
    c.beginPath();
    for (let x = BOUNDS.left; x <= BOUNDS.right + .02; x += .035) {const p = this.screen({x, y: value(level.curve, x)});if (x === BOUNDS.left) c.moveTo(p.x, p.y);else c.lineTo(p.x, p.y);}
    c.strokeStyle = '#69e6dc';c.lineWidth = 2.5;c.lineCap = 'round';c.lineJoin = 'round';c.stroke();
    for (const o of level.obstacles) {
      const p = this.screen(movingObstacle(o, state.time)), r = o.radius * this.scale;
      c.fillStyle = '#ff707b1e';c.strokeStyle = '#ff7b84';c.lineWidth = 1.5;c.beginPath();c.arc(p.x, p.y, r, 0, Math.PI * 2);c.fill();c.stroke();
      c.beginPath();c.moveTo(p.x - r * .32, p.y - r * .32);c.lineTo(p.x + r * .32, p.y + r * .32);c.moveTo(p.x + r * .32, p.y - r * .32);c.lineTo(p.x - r * .32, p.y + r * .32);c.stroke();
    }
    if (state.hint !== null) {
      const p = this.screen({x: state.hint, y: value(level.curve, state.hint)});
      c.strokeStyle = '#d5fb6880';c.lineWidth = 1;c.setLineDash([3, 5]);c.beginPath();c.arc(p.x, p.y, 18, 0, Math.PI * 2);c.stroke();c.setLineDash([]);
    }
    for (const t of level.targets) {
      const taken = state.damage.get(t.id) ?? 0;
      const p = this.screen(movingTarget(level, t, state.time, taken)), r = t.radius * this.scale;
      if (state.destroyed.has(t.id)) {c.strokeStyle = '#d5fb6833';c.lineWidth = 1;c.beginPath();c.arc(p.x, p.y, r + 2, 0, Math.PI * 2);c.stroke();continue;}
      c.fillStyle = '#d5fb6812';c.strokeStyle = '#d5fb6855';c.lineWidth = 1;c.beginPath();c.arc(p.x, p.y, r + 5, 0, Math.PI * 2);c.fill();c.stroke();
      c.fillStyle = t.boss ? '#ff86ce' : '#d5fb68';c.beginPath();c.arc(p.x, p.y, r, 0, Math.PI * 2);c.fill();
      if (resistance(t) > 1) {
        c.strokeStyle = t.boss ? '#ff86ce' : '#d5fb68';c.lineWidth = t.boss ? 2 : 1;
        c.beginPath();c.arc(p.x, p.y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (resistance(t) - taken) / resistance(t));c.stroke();
      }
      c.fillStyle = '#192c27';c.beginPath();c.arc(p.x, p.y, 2, 0, Math.PI * 2);c.fill();
      c.fillStyle = '#baca92';c.font = '8px ui-monospace,monospace';c.textAlign = 'center';
      const position = movingTarget(level, t, state.time, taken);
      const textX = Math.max(47, Math.min(this.w - 47, p.x));
      c.fillText(t.boss ? `GARDIEN ${resistance(t) - taken}/${resistance(t)}` : resistance(t) > 1 ? `BLINDÉE ${resistance(t) - taken}/${resistance(t)}` : `(${format(position.x, 1)} ; ${format(position.y, 1)})`, textX, p.y - r - 12 - (t.id % 2) * 14);
    }
    if (state.shot) {
      const age = now - state.shot.at, result = state.shot.result, p = this.screen(result.origin);
      const fadeStart = state.reducedMotion ? 180 : 500;
      const alpha = (state.reducedMotion ? .7 : 1) * Math.max(0, 1 - Math.max(0, age - fadeStart) / (shotDuration(state.reducedMotion) - fadeStart));
      c.globalAlpha = alpha;
      if (age > 110 || state.reducedMotion) {
        for (const b of result.beams) {
          const q = this.screen(b.end);c.strokeStyle = '#ff86ce';c.lineWidth = 7;c.globalAlpha = alpha * .12;c.beginPath();c.moveTo(p.x, p.y);c.lineTo(q.x, q.y);c.stroke();
          c.globalAlpha = alpha;c.strokeStyle = '#ff9ed9';c.lineWidth = 2;c.beginPath();c.moveTo(p.x, p.y);c.lineTo(q.x, q.y);c.stroke();
          if (b.blocked) {c.fillStyle = '#ff858b';c.beginPath();c.arc(q.x, q.y, 4, 0, Math.PI * 2);c.fill();}
        }
      }
      c.fillStyle = '#fff3d9';c.beginPath();c.arc(p.x, p.y, 5, 0, Math.PI * 2);c.fill();
      if (age < 700 && !state.reducedMotion) {c.strokeStyle = '#d5fb68';c.globalAlpha = 1 - age / 700;c.lineWidth = 1;c.beginPath();c.arc(p.x, p.y, 6 + age / 35, 0, Math.PI * 2);c.stroke();}
      c.globalAlpha = 1;
    }
    if (state.aim !== null) {
      const x = state.aim, p = this.screen({x, y: value(level.curve, x)});
      c.strokeStyle = '#edf9f077';c.setLineDash([2, 4]);c.lineWidth = 1;c.beginPath();c.moveTo(p.x, this.h - 32);c.lineTo(p.x, p.y);c.stroke();c.setLineDash([]);
      c.fillStyle = '#12212b';c.strokeStyle = '#fff';c.lineWidth = 2;c.beginPath();c.arc(p.x, p.y, 5, 0, Math.PI * 2);c.fill();c.stroke();
      c.fillStyle = '#edf1e9';c.font = '10px ui-monospace,monospace';c.textAlign = 'center';
      const labelY = p.y < 90 ? p.y + 30 : p.y - 20;c.fillText(`a ≈ ${format(x)}`, Math.max(65, Math.min(this.w - 65, p.x)), labelY);
    }
    c.restore();
  }
  describe(a: number): string { const c = this.getState().level.curve;return `Point d’abscisse ${format(a)}, ordonnée ${format(value(c, a))}. Pente ${format(derivative(c, a))}.`; }
}
