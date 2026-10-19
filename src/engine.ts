export type Direction = 'both' | 'left' | 'right';
export type Rule = Direction | 'choose';
export interface Point { x: number; y: number }
export interface Curve { kind: 'polynomial' | 'sine' | 'cosine'; coefficients: number[]; h: number; k: number; scale: number; label: string }
export interface Target extends Point { id: number; radius: number; motion: number; phase: number }
export interface Obstacle extends Point { radius: number }
export interface Level {
  id: number; world: number; number: number; title: string; instruction: string;
  curve: Curve; solution: number; solutionDirection: Direction; rule: Rule;
  targets: Target[]; obstacles: Obstacle[]; shots: number; seconds: number;
}
export const BOUNDS = { left: -5.5, right: 5.5, bottom: -4.7, top: 4.7 };
export const WORLDS = [
  { name: 'Tir horizontal', subtitle: 'Trouve le calme dans la courbe.', icon: '↔', color: '#d5fb68', lesson: 'Une tangente horizontale a une pente nulle : f′(a) = 0. Cela arrive aux extrema, mais aussi parfois ailleurs !' },
  { name: 'La bonne pente', subtitle: 'Change de point. Change de direction.', icon: '↗', color: '#69e6dc', lesson: 'La dérivée f′(a) donne la pente de la tangente. Le sens du laser indique ensuite de quel côté du point le rayon part.' },
  { name: 'Double impact', subtitle: 'Une tangente. Deux cibles.', icon: '◎', color: '#c2afff', lesson: 'Deux cibles et le point de tir doivent être alignés sur une même tangente. En tir unidirectionnel, les deux cibles doivent être du bon côté.' },
  { name: 'Zone interdite', subtitle: 'Lis la trajectoire. Évite le rouge.', icon: '◇', color: '#ffb17e', lesson: 'Un obstacle arrête la branche du laser qui le rencontre. Une cible derrière lui reste protégée. L’autre branche peut continuer.' },
  { name: 'Laser Master', subtitle: 'Compose le tir parfait.', icon: '✦', color: '#ff86ce', lesson: 'Les cibles mobiles restent atteignables. Les défis chronométrés laissent 25 secondes ; le mode libre permet de réfléchir sans limite.' },
] as const;
export const LEVELS_PER_WORLD = 12;
export const TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD;
export function value(c: Curve, x: number): number {
  const u = x - c.h;
  const v = c.kind === 'sine' ? Math.sin(u) : c.kind === 'cosine' ? Math.cos(u) : c.coefficients.reduceRight((a, b) => a * u + b, 0);
  return c.scale * v + c.k;
}
export function derivative(c: Curve, x: number): number {
  const u = x - c.h;
  if (c.kind === 'sine') return c.scale * Math.cos(u);
  if (c.kind === 'cosine') return -c.scale * Math.sin(u);
  return c.scale * c.coefficients.slice(1).map((a, i) => a * (i + 1)).reduceRight((a, b) => a * u + b, 0);
}
export function tangent(c: Curve, a: number, x: number): number { return value(c, a) + derivative(c, a) * (x - a); }
export function format(n: number, digits = 2): string { return Number(n.toFixed(digits)).toLocaleString('fr-FR').replace('-', '−'); }
function shifted(h: number): string { return h === 0 ? 'x' : `(x ${h > 0 ? '−' : '+'} ${format(Math.abs(h))})`; }
function curve(kind: number, h: number, k: number, invert: boolean): Curve {
  const s = invert ? -1 : 1;
  const tail = k === 0 ? '' : ` ${k > 0 ? '+' : '−'} ${format(Math.abs(k))}`;
  const u = shifted(h);
  const specs: [Curve['kind'], number[], number, string][] = [
    ['polynomial', [0, 0, 1], .22 * s, `${s < 0 ? '−' : ''}0,22${u}²`],
    ['polynomial', [0, 0, 0, 1], .055 * s, `${s < 0 ? '−' : ''}0,055${u}³`],
    ['sine', [], 1.1 * s, `${s < 0 ? '−' : ''}1,1 sin(${u})`],
    ['polynomial', [0, -2, 0, 1], .075 * s, `${s < 0 ? '−' : ''}0,075[${u}³ − 2${u}]`],
    ['polynomial', [0, 0, -2, 0, 1], .025 * s, `${s < 0 ? '−' : ''}0,025[${u}⁴ − 2${u}²]`],
    ['cosine', [], 1.1 * s, `${s < 0 ? '−' : ''}1,1 cos(${u})`],
  ];
  const [type, coefficients, scale, label] = specs[kind % specs.length];
  return {kind: type, coefficients, scale, h, k, label: `f(x) = ${label}${tail}`};
}
export function makeLevel(id: number, variant = 0): Level {
  if (!Number.isInteger(id) || id < 0 || id >= TOTAL_LEVELS) throw new RangeError('Niveau inconnu');
  const world = Math.floor(id / LEVELS_PER_WORLD), number = id % LEVELS_PER_WORLD;
  const seed = number + variant * 7;
  const h = variant === 0 && number === 0 ? 0 : [-.75, 0, .75][seed % 3];
  const k = [0, -.5, .5][(seed + world) % 3];
  const kind = world === 0 ? [0, 0, 5, 0, 4, 5, 0, 4, 5, 1, 4, 1][number] : [0, 0, 1, 2, 0, 3, 5, 1, 4, 2, 3, 4][(seed + world - 1) % 12];
  const c = curve(kind, h, k, seed % 4 === 3);
  const solution = world === 0 ? h : h + [-1.5, 1, -1, 1.5, -.75, .75][seed % 6];
  let rule: Rule = world === 0 ? (number < 6 ? 'both' : ['right', 'left', 'choose'][number % 3] as Rule) : ['both', 'right', 'left', 'choose'][number % 4] as Rule;
  if (world >= 3 && number > 7) rule = 'choose';
  const direction: Direction = rule === 'choose' ? (seed % 2 ? 'left' : 'right') : rule;
  const sign = direction === 'left' ? -1 : 1;
  const distances = world >= 2 ? (direction === 'both' ? [-2.65, 2.65] : [1.65 * sign, 3 * sign]) : [2.7 * sign];
  const targets = distances.map((d, i) => {
    const x = Math.max(-4.85, Math.min(4.85, solution + d));
    return {id: i, x, y: tangent(c, solution, x), radius: .3 - world * .025 - number * .002, motion: world === 4 && number >= 3 ? .25 : 0, phase: i * Math.PI};
  });
  // A target's complete movement remains inside the plot; adapt slope/vertical offset if needed.
  const extent = Math.max(...targets.map(t => Math.abs(t.y - c.k)));
  if (extent > 3.5) { c.scale *= 3.5 / extent; c.label = `f(x) = ${format(c.scale, 4)} × ${c.kind === 'sine' ? `sin(${shifted(h)})` : c.kind === 'cosine' ? `cos(${shifted(h)})` : `[${c.coefficients.map((a, i) => a ? `${a}·${shifted(h)}^${i}` : '').filter(Boolean).join(' + ')}]`} ${c.k >= 0 ? '+' : '−'} ${format(Math.abs(c.k))}`; }
  targets.forEach(t => { t.y = tangent(c, solution, t.x); });
  const obstacles: Obstacle[] = [];
  if (world >= 3) {
    const m = derivative(c, solution), norm = Math.hypot(1, m);
    // Offset from the intended tangent by at least 0.85 units: never blocks its solution.
    for (const d of [1.15, -1.4]) {
      const x = solution + d, y = tangent(c, solution, x);
      const side = d > 0 ? 1 : -1;
      const obstacle = {x: x - m / norm * .95 * side, y: y + .95 / norm * side, radius: .34};
      if (Math.abs(obstacle.x) < 5 && Math.abs(obstacle.y) < 4) obstacles.push(obstacle);
    }
    if (rule === 'choose') {
      const x = solution - sign * 1.3;
      obstacles.push({x, y: tangent(c, solution, x), radius: .32});
    }
  }
  const titles = world === 0 ? ['Premier contact', 'Trouve le sommet', 'Une autre courbe', 'Le creux de la vague', 'Courbe en W', 'Au sommet de l’onde', 'Cap à droite', 'Cap à gauche', 'À toi de choisir', 'Le calme sans sommet', 'Plusieurs chemins', 'L’équilibre parfait'] : ['Prends la tangente', 'Cap à droite', 'Retour à gauche', 'Choisis ton sens', 'Lis la courbe', 'Le bon angle', 'Change de perspective', 'Une ligne, un choix', 'Précision lumineuse', 'Le détour juste', 'L’instant décisif', 'Le dernier rayon'];
  return { id, world, number, title: titles[number], curve: c, solution, solutionDirection: direction, rule, targets, obstacles,
    shots: world >= 2 ? 2 : 3, seconds: world === 4 && number % 3 === 2 ? 25 : 0,
    instruction: world === 0 ? (number === 9 || number === 11 ? 'Trouve une tangente horizontale, même sans extremum.' : 'Touche la courbe là où la tangente est horizontale.') : world === 2 ? 'Détruis les deux cibles avec une seule tangente.' : world >= 3 ? 'Atteins les cibles : les obstacles rouges arrêtent le rayon.' : 'Choisis le point dont la tangente atteint la cible.' };
}
export function movingTarget(level: Level, t: Target, time: number): Point {
  const x = t.x + t.motion * Math.sin(time * .85 + t.phase);
  return {x, y: t.y + derivative(level.curve, level.solution) * (x - t.x)};
}
/** Fit the useful part of the graph without stretching either coordinate axis. */
export function projection(level: Level, width: number, height: number) {
  const compact = height < 350, short = height < 210;
  const top = compact ? 31 : 47, bottom = compact ? 24 : 35;
  const ys = [0, value(level.curve, level.solution), ...level.obstacles.flatMap(o => [o.y - o.radius, o.y + o.radius]), ...level.targets.flatMap(t => {
    const dy = Math.abs(derivative(level.curve, level.solution) * t.motion) + t.radius;
    return [t.y - dy, t.y + dy];
  })];
  const low = Math.min(...ys), high = Math.max(...ys);
  const span = Math.max(short ? 3 : compact ? 5.5 : 8, high - low + 1.3);
  const scale = Math.min((width - 38) / 11, (height - top - bottom) / span);
  const center = {x: width / 2, y: top + (height - top - bottom) / 2 + (high + low) / 2 * scale};
  return {scale, center, top, bottom};
}
/** Positive distance along an oriented ray, or null if the circle is not intersected. */
export function rayCircle(origin: Point, unit: Point, center: Point, radius: number): number | null {
  const dx = center.x - origin.x, dy = center.y - origin.y;
  const along = dx * unit.x + dy * unit.y;
  const perpendicular2 = dx * dx + dy * dy - along * along;
  if (perpendicular2 > radius * radius + 1e-10) return null;
  const half = Math.sqrt(Math.max(0, radius * radius - perpendicular2));
  if (along + half < 0) return null;
  return Math.max(0, along - half);
}
export interface ShotResult { origin: Point; slope: number; hits: number[]; impacts: {id: number; precision: number}[]; beams: {end: Point; blocked: boolean}[] }
export function fire(level: Level, a: number, direction: Direction, time: number, destroyed: Set<number> = new Set()): ShotResult {
  const origin = {x: a, y: value(level.curve, a)}, slope = derivative(level.curve, a);
  const impacts = new Map<number, number>(), beams: ShotResult['beams'] = [];
  const signs = direction === 'both' ? [-1, 1] : direction === 'left' ? [-1] : [1];
  for (const sign of signs) {
    const norm = Math.hypot(1, slope), unit = {x: sign / norm, y: sign * slope / norm};
    let stop = 35, blocked = false;
    for (const o of level.obstacles) { const d = rayCircle(origin, unit, o, o.radius); if (d !== null && d < stop) {stop = d; blocked = true;} }
    for (const t of level.targets) {
      if (destroyed.has(t.id)) continue;
      const center = movingTarget(level, t, time), d = rayCircle(origin, unit, center, t.radius);
      if (d !== null && d < stop - 1e-8) {
        const along = Math.max(0, Math.min(stop, (center.x - origin.x) * unit.x + (center.y - origin.y) * unit.y));
        const distance = Math.hypot(center.x - origin.x - unit.x * along, center.y - origin.y - unit.y * along);
        const precision = Math.max(0, Math.min(1, 1 - distance / t.radius));
        impacts.set(t.id, Math.max(impacts.get(t.id) ?? 0, precision));
      }
    }
    beams.push({end: {x: origin.x + unit.x * stop, y: origin.y + unit.y * stop}, blocked});
  }
  // Horizontal-world task: a very small slope tolerance accommodates touch input.
  if (level.world === 0 && Math.abs(slope) > .065) impacts.clear();
  return {origin, slope, hits: [...impacts.keys()], impacts: [...impacts].map(([id, precision]) => ({id, precision})), beams};
}
export const ruleLabel = (rule: Rule) => ({both: '↔ Double rayon', left: '← Vers la gauche', right: 'Vers la droite →', choose: '← Sens au choix →'})[rule];
