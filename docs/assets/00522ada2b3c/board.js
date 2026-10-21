import { BOUNDS, curvePoint, derivative, format, movingObstacle, movingTarget, parameterRange, projection, resistance, unitTangent } from './engine.js';
export const shotDuration = (reducedMotion) => reducedMotion ? 300 : 1400;
export class Board {
    canvas;
    getState;
    onResize;
    ctx;
    background = document.createElement('canvas');
    w = 0;
    h = 0;
    ratio = 1;
    scale = 1;
    center = { x: 0, y: 0 };
    previousLevel = null;
    constructor(canvas, getState, onResize) {
        this.canvas = canvas;
        this.getState = getState;
        this.onResize = onResize;
        this.ctx = canvas.getContext('2d', { alpha: false });
        new ResizeObserver(() => this.resize()).observe(canvas);
        this.resize();
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height)
            return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        if (rect.width === this.w && rect.height === this.h && ratio === this.ratio)
            return;
        this.w = rect.width;
        this.h = rect.height;
        this.ratio = ratio;
        const width = Math.round(this.w * this.ratio), height = Math.round(this.h * this.ratio);
        if (this.canvas.width !== width)
            this.canvas.width = width;
        if (this.canvas.height !== height)
            this.canvas.height = height;
        this.previousLevel = this.getState().level;
        this.updateProjection();
        this.drawBackground();
        // ResizeObserver runs after animation callbacks, just before presentation.
        // Resizing clears the bitmap: repaint now rather than exposing a blank frame.
        this.draw(performance.now());
        this.onResize();
    }
    updateProjection() {
        const p = projection(this.getState().level, this.w, this.h);
        this.scale = p.scale;
        this.center = p.center;
    }
    screen(p) { return { x: this.center.x + p.x * this.scale, y: this.center.y - p.y * this.scale }; }
    math(p) { return { x: (p.x - this.center.x) / this.scale, y: (this.center.y - p.y) / this.scale }; }
    nearest(clientX, clientY, previous = null) {
        const rect = this.canvas.getBoundingClientRect(), p = { x: clientX - rect.left, y: clientY - rect.top };
        const c = this.getState().level.curve;
        if (this.getState().level !== this.previousLevel)
            this.updateProjection();
        if (c.kind === 'parametric') {
            const [min, max] = parameterRange(c), step = (max - min) / 720;
            const distance = (t) => { const q = this.screen(curvePoint(c, t)); return Math.hypot(q.x - p.x, q.y - p.y); };
            let a = min, best = Infinity;
            for (let i = 0; i <= 720; i++) {
                const t = min + i * step, d = distance(t);
                const gap = previous === null ? Infinity : Math.abs(t - previous), continuous = Math.min(gap, max - min - gap) < .3;
                const score = d - (continuous ? 1.5 : 0);
                if (score < best) {
                    a = t;
                    best = score;
                }
            }
            // Refine the selected branch without jumping at a self-intersection.
            let left = Math.max(min, a - step), right = Math.min(max, a + step);
            for (let i = 0; i < 22; i++) {
                const l = left + (right - left) / 3, r = right - (right - left) / 3;
                if (distance(l) < distance(r))
                    right = r;
                else
                    left = l;
            }
            a = (left + right) / 2;
            return { a, distance: distance(a) };
        }
        let a = 0, best = Infinity;
        for (let x = BOUNDS.left + .15; x <= BOUNDS.right - .15; x += .025) {
            const q = this.screen(curvePoint(c, x)), dist = Math.hypot(q.x - p.x, q.y - p.y);
            if (dist < best) {
                a = x;
                best = dist;
            }
        }
        return { a: Math.round(a * 40) / 40, distance: best };
    }
    drawBackground() {
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;
        const c = this.background.getContext('2d');
        c.scale(this.ratio, this.ratio);
        c.fillStyle = '#0c172d';
        c.fillRect(0, 0, this.w, this.h);
        const gradient = c.createRadialGradient(this.center.x, this.center.y, 0, this.center.x, this.center.y, this.w * .65);
        gradient.addColorStop(0, '#29486f70');
        gradient.addColorStop(.65, '#17334b28');
        gradient.addColorStop(1, '#0b142900');
        c.fillStyle = gradient;
        c.fillRect(0, 0, this.w, this.h);
        // Deterministic stars are cached with the grid, so no extra animation is needed.
        for (let i = 0; i < 38; i++) {
            const x = ((i * 127 + 43) % 997) / 997 * this.w, y = ((i * 233 + 71) % 991) / 991 * this.h;
            c.fillStyle = i % 5 === 0 ? '#aecfff38' : '#96b8e51b';
            c.beginPath();
            c.arc(x, y, i % 5 === 0 ? .85 : .5, 0, Math.PI * 2);
            c.fill();
        }
        const p = projection(this.getState().level, this.w, this.h);
        const low = { x: this.screen({ x: BOUNDS.left, y: 0 }).x, y: this.h - p.bottom };
        const high = { x: this.screen({ x: BOUNDS.right, y: 0 }).x, y: p.top };
        const minY = (this.center.y - low.y) / this.scale, maxY = (this.center.y - high.y) / this.scale;
        c.save();
        c.beginPath();
        c.rect(6, p.top - 12, this.w - 12, this.h - p.top - p.bottom + 18);
        c.clip();
        c.lineWidth = 1;
        for (let x = -5; x <= 5; x++) {
            const p = this.screen({ x, y: 0 });
            c.strokeStyle = x === 0 ? '#7794b591' : '#6685b025';
            c.beginPath();
            c.moveTo(p.x, high.y);
            c.lineTo(p.x, low.y);
            c.stroke();
            if (x && (this.scale > 29 || x % 2 === 0)) {
                c.fillStyle = '#6d8593';
                c.font = '9px ui-monospace,monospace';
                c.textAlign = 'center';
                c.fillText(String(x).replace('-', '−'), p.x, this.center.y + 15);
            }
        }
        for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
            const p = this.screen({ x: 0, y });
            c.strokeStyle = y === 0 ? '#7794b591' : '#6685b025';
            c.beginPath();
            c.moveTo(low.x, p.y);
            c.lineTo(high.x, p.y);
            c.stroke();
            if (y && (this.scale > 29 || y % 2 === 0)) {
                c.fillStyle = '#6d8593';
                c.font = '9px ui-monospace,monospace';
                c.textAlign = 'right';
                c.fillText(String(y).replace('-', '−'), this.center.x - 9, p.y + 3);
            }
        }
        c.fillStyle = '#93a8b2';
        c.font = 'italic 11px Georgia,serif';
        c.textAlign = 'center';
        c.fillText('x', high.x + 9, this.center.y + 4);
        c.fillText('y', this.center.x, high.y - 10);
        c.font = '9px ui-monospace,monospace';
        c.fillStyle = '#6d8593';
        c.fillText('0', this.center.x - 10, this.center.y + 15);
        c.strokeStyle = '#536775';
        c.beginPath();
        c.moveTo(high.x - 4, this.center.y - 3);
        c.lineTo(high.x + 1, this.center.y);
        c.lineTo(high.x - 4, this.center.y + 3);
        c.moveTo(this.center.x - 3, high.y + 4);
        c.lineTo(this.center.x, high.y - 1);
        c.lineTo(this.center.x + 3, high.y + 4);
        c.stroke();
        c.restore();
    }
    draw(now) {
        const c = this.ctx, state = this.getState(), level = state.level;
        // Expose the rendered simulation clock for deterministic canvas QA.
        this.canvas.dataset.time = state.time.toFixed(3);
        this.canvas.dataset.level = String(level.id);
        if (level !== this.previousLevel) {
            this.previousLevel = level;
            this.updateProjection();
            this.drawBackground();
        }
        const tip = document.getElementById('first-tip');
        if (tip && !tip.hidden) {
            const p = this.screen(curvePoint(level.curve, level.solution));
            tip.style.left = `${p.x}px`;
            tip.style.top = `${p.y}px`;
        }
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(this.background, 0, 0);
        c.scale(this.ratio, this.ratio);
        const camera = projection(level, this.w, this.h);
        c.save();
        c.beginPath();
        c.rect(12, camera.top - 1, this.w - 24, this.h - camera.top - camera.bottom + 4);
        c.clip();
        c.beginPath();
        const parametric = level.curve.kind === 'parametric', [min, max] = parametric ? parameterRange(level.curve) : [BOUNDS.left, BOUNDS.right];
        const steps = parametric ? 640 : 315;
        for (let i = 0; i <= steps; i++) {
            const p = this.screen(curvePoint(level.curve, min + (max - min) * i / steps));
            if (!i)
                c.moveTo(p.x, p.y);
            else
                c.lineTo(p.x, p.y);
        }
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.strokeStyle = '#75e8ed10';
        c.lineWidth = 12;
        c.stroke();
        c.strokeStyle = '#75e8ed20';
        c.lineWidth = 6;
        c.stroke();
        const curveGlow = c.createLinearGradient(0, 0, this.w, this.h);
        curveGlow.addColorStop(0, '#9bb9ff');
        curveGlow.addColorStop(.45, '#a4fff0');
        curveGlow.addColorStop(1, '#65ddec');
        c.strokeStyle = curveGlow;
        c.lineWidth = 2.7;
        c.stroke();
        if (parametric) {
            // A solid arrow with a dark outline stays legible over the luminous curve.
            const size = this.w < 420 || this.h < 210 ? 8 : 11;
            for (const fraction of [.12, .37, .62, .87]) {
                const t = min + (max - min) * fraction, p = this.screen(curvePoint(level.curve, t)), v = unitTangent(level.curve, t);
                c.save();
                c.translate(p.x, p.y);
                c.rotate(Math.atan2(-v.y, v.x));
                c.beginPath();
                c.moveTo(size * .9, 0);
                c.lineTo(-size * .15, -size * .55);
                c.lineTo(-size * .15, -size * .19);
                c.lineTo(-size * .85, -size * .19);
                c.lineTo(-size * .85, size * .19);
                c.lineTo(-size * .15, size * .19);
                c.lineTo(-size * .15, size * .55);
                c.closePath();
                c.strokeStyle = '#0b1429';
                c.lineWidth = 3;
                c.stroke();
                c.fillStyle = '#f0d4ff';
                c.fill();
                c.restore();
            }
        }
        for (const o of level.obstacles) {
            const p = this.screen(movingObstacle(o, state.time)), r = o.radius * this.scale;
            const fill = c.createRadialGradient(p.x - r * .3, p.y - r * .4, 0, p.x, p.y, r);
            fill.addColorStop(0, '#773950');
            fill.addColorStop(1, '#321e3d');
            c.strokeStyle = '#ff7c9c18';
            c.lineWidth = 5;
            c.beginPath();
            c.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = fill;
            c.strokeStyle = '#ff91a8';
            c.lineWidth = 1.3;
            c.beginPath();
            c.arc(p.x, p.y, r, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.beginPath();
            c.moveTo(p.x - r * .32, p.y - r * .32);
            c.lineTo(p.x + r * .32, p.y + r * .32);
            c.moveTo(p.x + r * .32, p.y - r * .32);
            c.lineTo(p.x - r * .32, p.y + r * .32);
            c.stroke();
        }
        if (state.hint !== null) {
            const p = this.screen(curvePoint(level.curve, state.hint));
            c.strokeStyle = '#d5fb6880';
            c.lineWidth = 1;
            c.setLineDash([3, 5]);
            c.beginPath();
            c.arc(p.x, p.y, 18, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
        }
        for (const t of level.targets) {
            const taken = state.damage.get(t.id) ?? 0;
            const p = this.screen(movingTarget(level, t, state.time, taken)), r = t.radius * this.scale;
            if (state.destroyed.has(t.id)) {
                c.strokeStyle = '#d5fb6833';
                c.lineWidth = 1;
                c.beginPath();
                c.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
                c.stroke();
                continue;
            }
            const halo = c.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 9);
            halo.addColorStop(0, t.boss ? '#ff86ce26' : '#e5f89c22');
            halo.addColorStop(1, '#00000000');
            c.fillStyle = halo;
            c.beginPath();
            c.arc(p.x, p.y, r + 9, 0, Math.PI * 2);
            c.fill();
            const orb = c.createRadialGradient(p.x - r * .3, p.y - r * .35, r * .05, p.x, p.y, r);
            orb.addColorStop(0, t.boss ? '#ffe5f7' : '#fffbd9');
            orb.addColorStop(.45, t.boss ? '#ff9bdb' : '#eff8a3');
            orb.addColorStop(1, t.boss ? '#ce539b' : '#a5cf68');
            c.fillStyle = orb;
            c.beginPath();
            c.arc(p.x, p.y, r, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = t.boss ? '#ffd0f0cc' : '#faffd2cc';
            c.lineWidth = .8;
            c.stroke();
            if (resistance(t) > 1) {
                c.strokeStyle = t.boss ? '#ff86ce' : '#d5fb68';
                c.lineWidth = t.boss ? 2 : 1;
                c.beginPath();
                c.arc(p.x, p.y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (resistance(t) - taken) / resistance(t));
                c.stroke();
            }
            c.strokeStyle = t.boss ? '#6f2752' : '#63854b';
            c.lineWidth = .8;
            c.beginPath();
            c.arc(p.x, p.y, Math.max(1.6, r * .28), 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = '#ffffffdc';
            c.beginPath();
            c.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#baca92';
            c.font = '8px ui-monospace,monospace';
            c.textAlign = 'center';
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
                    const q = this.screen(b.end);
                    c.strokeStyle = '#ff86ce';
                    c.lineWidth = 7;
                    c.globalAlpha = alpha * .12;
                    c.beginPath();
                    c.moveTo(p.x, p.y);
                    c.lineTo(q.x, q.y);
                    c.stroke();
                    c.globalAlpha = alpha;
                    c.strokeStyle = '#ff9ed9';
                    c.lineWidth = 2;
                    c.beginPath();
                    c.moveTo(p.x, p.y);
                    c.lineTo(q.x, q.y);
                    c.stroke();
                    if (b.blocked) {
                        c.fillStyle = '#ff858b';
                        c.beginPath();
                        c.arc(q.x, q.y, 4, 0, Math.PI * 2);
                        c.fill();
                    }
                }
            }
            c.fillStyle = '#fff3d9';
            c.beginPath();
            c.arc(p.x, p.y, 5, 0, Math.PI * 2);
            c.fill();
            if (age < 700 && !state.reducedMotion) {
                c.strokeStyle = '#d5fb68';
                c.globalAlpha = 1 - age / 700;
                c.lineWidth = 1;
                c.beginPath();
                c.arc(p.x, p.y, 6 + age / 35, 0, Math.PI * 2);
                c.stroke();
            }
            if (!state.reducedMotion && age > 110 && age < 750) {
                const progress = (age - 110) / 640;
                c.globalAlpha = (1 - progress) ** 2;
                for (const impact of state.shot.impacts) {
                    const center = this.screen(impact);
                    for (let i = 0; i < 10; i++) {
                        const angle = i * Math.PI / 5 + .2, distance = 5 + 23 * progress;
                        const x = center.x + Math.cos(angle) * distance, y = center.y + Math.sin(angle) * distance;
                        c.fillStyle = i % 2 ? '#e7f9ad' : '#b7fff1';
                        c.beginPath();
                        c.arc(x, y, 1.4 * (1 - progress) + .3, 0, Math.PI * 2);
                        c.fill();
                    }
                }
            }
            c.globalAlpha = 1;
        }
        if (state.aim !== null) {
            const x = state.aim, p = this.screen(curvePoint(level.curve, x));
            if (!parametric) {
                c.strokeStyle = '#edf9f077';
                c.setLineDash([2, 4]);
                c.lineWidth = 1;
                c.beginPath();
                c.moveTo(p.x, this.h - 32);
                c.lineTo(p.x, p.y);
                c.stroke();
                c.setLineDash([]);
            }
            c.fillStyle = '#12212b';
            c.strokeStyle = '#fff';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(p.x, p.y, 5, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.fillStyle = '#edf1e9';
            c.font = '10px ui-monospace,monospace';
            c.textAlign = 'center';
            const labelY = p.y < 90 ? p.y + 30 : p.y - 20;
            c.fillText(`${parametric ? 't' : 'a'} ≈ ${format(x)}`, Math.max(65, Math.min(this.w - 65, p.x)), labelY);
        }
        c.restore();
    }
    describe(a) { const c = this.getState().level.curve, p = curvePoint(c, a), v = unitTangent(c, a); return c.kind === 'parametric' ? `Paramètre t = ${format(a)}, point (${format(p.x)} ; ${format(p.y)}). Sens du parcours : (${format(v.x)} ; ${format(v.y)}).` : `Point d’abscisse ${format(a)}, ordonnée ${format(p.y)}. Pente ${format(derivative(c, a))}.`; }
}
