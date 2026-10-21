export const BOUNDS = { left: -5.5, right: 5.5, bottom: -4.7, top: 4.7 };
export const WORLDS = [
    { name: 'Tir horizontal', subtitle: 'Trouve le calme dans la courbe.', icon: '↔', color: '#d5fb68', lesson: 'Une tangente horizontale a une pente nulle : f′(a) = 0. Cela arrive aux extrema, mais aussi parfois ailleurs !' },
    { name: 'La bonne pente', subtitle: 'Change de point. Change de direction.', icon: '↗', color: '#69e6dc', lesson: 'La dérivée f′(a) donne la pente de la tangente. Le sens du laser indique ensuite de quel côté du point le rayon part.' },
    { name: 'Double impact', subtitle: 'Une tangente. Deux cibles.', icon: '◎', color: '#c2afff', lesson: 'Deux cibles et le point de tir doivent être alignés sur une même tangente. En tir unidirectionnel, les deux cibles doivent être du bon côté.' },
    { name: 'Zone interdite', subtitle: 'Lis la trajectoire. Évite le rouge.', icon: '◇', color: '#ffb17e', lesson: 'Un obstacle arrête la branche du laser et coûte une vie, même après une cible. Une collision ne peut retirer qu’une vie par tir.' },
    { name: 'Laser Master', subtitle: 'Deux cibles, plusieurs chemins.', icon: '✦', color: '#ff86ce', lesson: 'Certaines cibles demandent deux tangentes. D’autres, mobiles, peuvent s’aligner sur une même tangente à un instant précis : attends ce rendez-vous ou tire deux fois.' },
    { name: 'Trajectoires croisées', subtitle: 'Trois cibles. Deux ou trois tangentes.', icon: '⋈', color: '#8fbbff', lesson: 'Répartis tes tirs : deux cibles peuvent partager une tangente tandis que la troisième en demande une autre. Certains défis imposent trois trajectoires distinctes.' },
    { name: 'Champ instable', subtitle: 'Observe. Attends. Traverse.', icon: '⟁', color: '#ff8c9c', lesson: 'Les obstacles mobiles traversent les trajectoires. Attends qu’un passage se libère avant de tirer : les collisions sont calculées à l’instant du tir.' },
    { name: 'Orbites', subtitle: 'Suis le fil des courbes paramétrées.', icon: '◌', color: '#b7a8ff', lesson: 'Le point M(t) = (x(t), y(t)) parcourt la courbe quand t augmente, dans le sens des petites flèches. Le vecteur (x′(t), y′(t)) dirige la tangente : → suit le parcours, ← le remonte. Le laser peut donc partir vers la gauche de l’écran en choisissant →. Une tangente verticale est parfaitement possible.' },
];
export const LEVELS_PER_WORLD = 12;
export const TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD;
export function value(c, x) {
    if (c.kind === 'parametric')
        return curvePoint(c, x).y;
    const u = x - c.h;
    const v = c.kind === 'sine' ? Math.sin(u) : c.kind === 'cosine' ? Math.cos(u) : c.coefficients.reduceRight((a, b) => a * u + b, 0);
    return c.scale * v + c.k;
}
export function derivative(c, x) {
    if (c.kind === 'parametric') {
        const v = curveDerivative(c, x);
        return Math.abs(v.x) < 1e-12 ? Infinity : v.y / v.x;
    }
    const u = x - c.h;
    if (c.kind === 'sine')
        return c.scale * Math.cos(u);
    if (c.kind === 'cosine')
        return -c.scale * Math.sin(u);
    return c.scale * c.coefficients.slice(1).map((a, i) => a * (i + 1)).reduceRight((a, b) => a * u + b, 0);
}
export function tangent(c, a, x) { const p = curvePoint(c, a); return p.y + derivative(c, a) * (x - p.x); }
export function parameterRange(c) { return c.kind === 'parametric' ? [0, c.param.shape === 'spiral' ? 4 * Math.PI : 2 * Math.PI] : [-5.35, 5.35]; }
export function advanceParameter(c, t, step) {
    const [min, max] = parameterRange(c), next = t + step;
    return c.kind === 'parametric' && c.param.shape !== 'spiral' ? min + ((next - min) % (max - min) + max - min) % (max - min) : Math.max(min, Math.min(max, next));
}
/** Position and velocity use t directly, never an inverse y=f(x) representation. */
export function curvePoint(c, t) {
    if (c.kind !== 'parametric')
        return { x: t, y: value(c, t) };
    const p = c.param, u = p.orientation * t, r = p.shape === 'spiral' ? .7 + .13 * t : p.shape === 'petal' ? 1 + .25 * Math.cos(3 * u) : 1;
    const x = p.rx * (p.shape === 'eight' ? Math.sin(u) : r * Math.cos(u));
    const y = p.ry * (p.shape === 'eight' ? Math.sin(2 * u) : r * Math.sin(u));
    return { x: c.h + x * Math.cos(p.rotation) - y * Math.sin(p.rotation), y: c.k + x * Math.sin(p.rotation) + y * Math.cos(p.rotation) };
}
export function curveDerivative(c, t) {
    if (c.kind !== 'parametric')
        return { x: 1, y: derivative(c, t) };
    const p = c.param, d = p.orientation, u = d * t;
    const r = p.shape === 'spiral' ? .7 + .13 * t : p.shape === 'petal' ? 1 + .25 * Math.cos(3 * u) : 1;
    const dr = p.shape === 'spiral' ? .13 : p.shape === 'petal' ? -.75 * Math.sin(3 * u) * d : 0;
    const x = p.rx * (p.shape === 'eight' ? d * Math.cos(u) : dr * Math.cos(u) - r * Math.sin(u) * d);
    const y = p.ry * (p.shape === 'eight' ? 2 * d * Math.cos(2 * u) : dr * Math.sin(u) + r * Math.cos(u) * d);
    return { x: x * Math.cos(p.rotation) - y * Math.sin(p.rotation), y: x * Math.sin(p.rotation) + y * Math.cos(p.rotation) };
}
export function unitTangent(c, t) {
    const v = curveDerivative(c, t), norm = Math.hypot(v.x, v.y);
    if (norm < 1e-12)
        throw new RangeError('La tangente nécessite une vitesse non nulle');
    return { x: v.x / norm, y: v.y / norm };
}
export function format(n, digits = 2) { return Number(n.toFixed(digits)).toLocaleString('fr-FR').replace('-', '−'); }
function shifted(h) { return h === 0 ? 'x' : `(x ${h > 0 ? '−' : '+'} ${format(Math.abs(h))})`; }
function curve(kind, h, k, invert) {
    const s = invert ? -1 : 1;
    const tail = k === 0 ? '' : ` ${k > 0 ? '+' : '−'} ${format(Math.abs(k))}`;
    const u = shifted(h);
    const specs = [
        ['polynomial', [0, 0, 1], .22 * s, `${s < 0 ? '−' : ''}0,22${u}²`],
        ['polynomial', [0, 0, 0, 1], .055 * s, `${s < 0 ? '−' : ''}0,055${u}³`],
        ['sine', [], 1.1 * s, `${s < 0 ? '−' : ''}1,1 sin(${u})`],
        ['polynomial', [0, -2, 0, 1], .075 * s, `${s < 0 ? '−' : ''}0,075[${u}³ − 2${u}]`],
        ['polynomial', [0, 0, -2, 0, 1], .025 * s, `${s < 0 ? '−' : ''}0,025[${u}⁴ − 2${u}²]`],
        ['cosine', [], 1.1 * s, `${s < 0 ? '−' : ''}1,1 cos(${u})`],
    ];
    const [type, coefficients, scale, label] = specs[kind % specs.length];
    return { kind: type, coefficients, scale, h, k, label: `f(x) = ${label}${tail}` };
}
export function makeLevel(id, variant = 0) {
    if (!Number.isInteger(id) || id < 0 || id >= TOTAL_LEVELS)
        throw new RangeError('Niveau inconnu');
    const world = Math.floor(id / LEVELS_PER_WORLD), number = id % LEVELS_PER_WORLD;
    if (world === 7)
        return orbitLevel(id, variant);
    if (world >= 4)
        return advancedLevel(id, variant);
    const seed = number + variant * 7;
    const h = variant === 0 && number === 0 ? 0 : [-.75, 0, .75][seed % 3];
    const k = [0, -.5, .5][(seed + world) % 3];
    const kind = world === 0 ? [0, 0, 5, 0, 4, 5, 0, 4, 5, 1, 4, 1][number] : [0, 0, 1, 2, 0, 3, 5, 1, 4, 2, 3, 4][(seed + world - 1) % 12];
    const c = curve(kind, h, k, seed % 4 === 3);
    const solution = world === 0 ? h : h + [-1.5, 1, -1, 1.5, -.75, .75][seed % 6];
    let rule = world === 0 ? (number < 6 ? 'both' : ['right', 'left', 'choose'][number % 3]) : ['both', 'right', 'left', 'choose'][number % 4];
    if (world >= 3 && number > 7)
        rule = 'choose';
    const direction = rule === 'choose' ? (seed % 2 ? 'left' : 'right') : rule;
    const sign = direction === 'left' ? -1 : 1;
    const distances = world >= 2 ? (direction === 'both' ? [-2.65, 2.65] : [1.65 * sign, 3 * sign]) : [2.7 * sign];
    const targets = distances.map((d, i) => {
        const x = Math.max(-4.85, Math.min(4.85, solution + d));
        return { id: i, x, y: tangent(c, solution, x), radius: .3 - world * .025 - number * .002, motion: world === 4 && number >= 3 ? .25 : 0, phase: i * Math.PI };
    });
    // A target's complete movement remains inside the plot; adapt slope/vertical offset if needed.
    const extent = Math.max(...targets.map(t => Math.abs(t.y - c.k)));
    if (extent > 3.5) {
        c.scale *= 3.5 / extent;
        c.label = `f(x) = ${format(c.scale, 4)} × ${c.kind === 'sine' ? `sin(${shifted(h)})` : c.kind === 'cosine' ? `cos(${shifted(h)})` : `[${c.coefficients.map((a, i) => a ? `${a}·${shifted(h)}^${i}` : '').filter(Boolean).join(' + ')}]`} ${c.k >= 0 ? '+' : '−'} ${format(Math.abs(c.k))}`;
    }
    targets.forEach(t => { t.y = tangent(c, solution, t.x); });
    const obstacles = [];
    if (world >= 3) {
        const m = derivative(c, solution), norm = Math.hypot(1, m);
        // Offset from the intended tangent by at least 0.85 units: never blocks its solution.
        for (const d of [1.15, -1.4]) {
            const x = solution + d, y = tangent(c, solution, x);
            const side = d > 0 ? 1 : -1;
            const obstacle = { x: x - m / norm * .95 * side, y: y + .95 / norm * side, radius: .34 };
            if (Math.abs(obstacle.x) < 5 && Math.abs(obstacle.y) < 4)
                obstacles.push(obstacle);
        }
        if (rule === 'choose') {
            const x = solution - sign * 1.3;
            obstacles.push({ x, y: tangent(c, solution, x), radius: .32 });
        }
    }
    const titles = world === 0 ? ['Premier contact', 'Trouve le sommet', 'Une autre courbe', 'Le creux de la vague', 'Courbe en W', 'Au sommet de l’onde', 'Cap à droite', 'Cap à gauche', 'À toi de choisir', 'Le calme sans sommet', 'Plusieurs chemins', 'L’équilibre parfait'] : ['Prends la tangente', 'Cap à droite', 'Retour à gauche', 'Choisis ton sens', 'Lis la courbe', 'Le bon angle', 'Change de perspective', 'Une ligne, un choix', 'Précision lumineuse', 'Le détour juste', 'L’instant décisif', 'Le dernier rayon'];
    return { id, world, number, title: titles[number], curve: c, solution, solutionDirection: direction, rule, targets, obstacles,
        shots: 3, seconds: 0, par: 1,
        plan: [{ a: solution, direction, targets: targets.map(t => t.id) }],
        instruction: world === 0 ? (number === 9 || number === 11 ? 'Trouve une tangente horizontale, même sans extremum.' : 'Touche la courbe là où la tangente est horizontale.') : world === 2 ? 'Détruis les deux cibles avec une seule tangente.' : world >= 3 ? 'Atteins les cibles : les obstacles rouges arrêtent le rayon.' : 'Choisis le point dont la tangente atteint la cible.' };
}
function orbitLevel(id, variant) {
    const number = id % 12, phase = number < 3 ? 0 : (variant % 5) * .12;
    const shape = number < 5 ? 'ellipse' : number < 8 ? 'eight' : number < 10 ? 'spiral' : 'petal';
    const orientation = number === 4 || variant % 2 ? -1 : 1;
    const rx = number < 2 ? 2 : shape === 'ellipse' ? 2.4 : shape === 'eight' ? 2.35 : shape === 'spiral' ? 1.1 : 1.65;
    const ry = number < 2 ? 2 : shape === 'ellipse' ? 1.35 : shape === 'eight' ? 1.5 : shape === 'spiral' ? .9 : 1.5;
    const rotation = number === 3 ? Math.atan2(.6, .8) : 0;
    const param = { shape, rx, ry, rotation, orientation };
    const u = orientation === 1 ? 't' : '−t', fx = shape === 'eight' ? `sin(${u})` : `cos(${u})`, fy = shape === 'eight' ? `sin(2${u === 't' ? 't' : '(−t)'})` : `sin(${u})`;
    const radial = shape === 'spiral' || shape === 'petal';
    const term = (a, f) => `${format(Math.abs(a))}${f}`;
    const component = (a, f, b, g) => `${a < 0 ? '−' : ''}${term(a, f)}${Math.abs(b) < 1e-10 ? '' : ` ${b < 0 ? '−' : '+'} ${term(b, g)}`}`;
    const prefix = radial ? `r(t) = ${shape === 'spiral' ? '0,7 + 0,13t' : '1 + 0,25 cos(3t)'} ; ` : '';
    const c = { kind: 'parametric', coefficients: [], h: 0, k: 0, scale: 1, param, label: `${prefix}x(t) = ${component(rx * Math.cos(rotation), radial ? `r(t) ${fx}` : fx, -ry * Math.sin(rotation), fy)} ; y(t) = ${component(ry * Math.cos(rotation), radial ? `r(t) ${fy}` : fy, rx * Math.sin(rotation), fx)}` };
    const rules = ['both', 'right', 'left', 'choose', 'right', 'both', 'right', 'left', 'right', 'choose', 'choose', 'choose'];
    const rule = rules[number], chosen = rule === 'choose' ? number % 2 ? 'left' : 'right' : rule;
    const anchors = [0, Math.PI / 2, Math.PI / 2, .75 * Math.PI, 0, Math.PI / 4, Math.PI / 2, 1.25 * Math.PI, 3 * Math.PI, 2.5 * Math.PI, .4 * Math.PI, 0];
    const a = anchors[number] + phase;
    const targets = [], plan = [];
    function target(anchor, direction, distance) {
        const origin = curvePoint(c, anchor), v = unitTangent(c, anchor), sign = direction === 'left' ? -1 : 1;
        return { x: origin.x + sign * v.x * distance, y: origin.y + sign * v.y * distance, anchor };
    }
    function add(anchor, direction, distance = 1.5, hp = 1) {
        const t = { ...target(anchor, direction, distance), id: targets.length, radius: number < 5 ? .26 : .23, motion: number >= 6 ? .13 : 0, phase: targets.length * Math.PI, hp };
        targets.push(t);
        for (let i = 0; i < hp; i++)
            plan.push({ a: anchor, direction, targets: [t.id] });
    }
    if (number === 11) {
        const angles = [phase, phase + Math.PI / 2, phase + Math.PI, phase + 3 * Math.PI / 2];
        const stages = angles.map((angle, i) => target(angle, i % 2 ? 'left' : 'right', 1.3));
        targets.push({ ...stages[0], id: 0, hp: 4, boss: true, stages, radius: .28, motion: .12, phase: 0 });
        angles.forEach((angle, stage) => plan.push({ a: angle, direction: stage % 2 ? 'left' : 'right', targets: [0], stage }));
    }
    else if (number === 3) {
        add(a, chosen, 1.15);
        add(a, chosen, 1.95);
        plan.splice(0, plan.length, { a, direction: chosen, targets: [0, 1] });
    }
    else {
        add(a, chosen, 1.5, number === 10 ? 2 : 1);
        if (number === 7 || number === 9 || number === 10)
            add(a + Math.PI / 2, rule === 'left' ? 'left' : 'right');
    }
    const obstacles = [];
    if (number >= 9) {
        for (const side of [-1, 1]) {
            const origin = curvePoint(c, a), v = unitTangent(c, a);
            const o = { x: origin.x + v.x * .8 - v.y * side, y: origin.y + v.y * .8 + v.x * side, radius: .22, motionX: .12, motionY: .1, phase: side };
            if (Math.abs(o.x) + .4 > 5.5 || Math.abs(o.y) + .4 > 4.7)
                continue;
            if (plan.every(s => { const p = curvePoint(c, s.a), u = unitTangent(c, s.a); return Math.abs((o.x - p.x) * u.y - (o.y - p.y) * u.x) > .55; }))
                obstacles.push(o);
        }
    }
    const names = ['Première orbite', 'Suis le parcours', 'À contre-sens', 'L’ellipse inclinée', 'L’autre rotation', 'La boucle en huit', 'La tangente verticale', 'Deux branches', 'La spirale', 'Deux tours de piste', 'L’orbite ondulée', 'Le gardien orbital'];
    return { id, world: 7, number, title: names[number], curve: c, solution: plan[0].a, solutionDirection: plan[0].direction, rule, targets, obstacles, par: plan.length, plan, shots: Math.max(3, plan.length + 1), seconds: 0,
        instruction: number === 11 ? 'Le gardien change d’orbite à chaque impact. Suis les flèches.' : number === 0 ? 'Touche le cercle : sa tangente peut être verticale.' : number === 3 ? 'Deux cibles sur une tangente. Choisis le sens du tir.' : number === 7 || number === 9 || number === 10 ? 'Répartis les impacts. → suit le parcours, ← le remonte.' : '→ suit les petites flèches ; ← va dans le sens inverse.' };
}
function advancedLevel(id, variant) {
    const world = Math.floor(id / 12), number = id % 12, seed = number + variant * 7;
    const h = [-.5, 0, .5][seed % 3], k = [-.4, 0, .4][(seed + 1) % 3];
    const varied = world === 4 && number >= 5 && number <= 10;
    const kind = varied ? [1, 2, 0, 5, 3, 4][number - 5] : world === 4 ? [0, 0, 2, 3, 0, 0, 0, 0, 0, 0, 0, 2][number] : world === 5 ? [0, 0, 2, 1, 5, 3, 4, 2, 1, 5, 4, 3][number] : [2, 0, 5, 1, 4, 3, 2, 0, 5, 1, 4, 5][number];
    const invert = world === 4 ? number === 1 || number === 4 || (varied && seed % 3 === 1) : seed % 4 === 1 || number === 7;
    const c = curve(kind, h, k, invert);
    const rule = number % 4 === 0 ? 'both' : 'choose';
    const radius = Math.max(.165, .205 - (world - 4) * .012 - number * .001);
    let targets, plan, combination;
    const rendezvous = world === 4 ? [4, 5, 8, 10].includes(number) : (world === 5 && number === 10) || (world === 6 && number % 4 === 0);
    const triple = world >= 5 && !rendezvous;
    const mobile = rendezvous || (world === 4 && number === 7) || (world >= 5 && number >= 6);
    const directionFor = (a, x) => rule === 'both' ? 'both' : x < a ? 'left' : 'right';
    function target(a, x, i) {
        return { id: i, x, y: tangent(c, a, x), anchor: a, radius, motion: mobile ? varied ? .33 : .22 : 0, phase: i % 2 ? Math.PI : 0 };
    }
    if (rendezvous) {
        // Each target travels along its own tangent, and they cross the common tangent
        // at t = nπ/0.85. Individual shots work; timing can combine several impacts.
        const oblique = varied || world >= 5, count = world >= 5 && number >= 8 ? 3 : 2;
        const a = oblique ? h + (number === 8 ? -.9 : number === 10 ? 1.6 : 1.1) : h;
        let anchors = world >= 5 && number >= 8 ? [h - 3, h + 1.5, h + 3] : [h - 3, h + 3];
        if (oblique) {
            const candidates = Array.from({ length: 33 }, (_, i) => -3.2 + i * .2 + h).filter(anchor => Math.abs(anchor - a) > .65).map(anchor => {
                const m = derivative(c, a), n = derivative(c, anchor), x = (value(c, anchor) - n * anchor - value(c, a) + m * a) / (m - n);
                return { anchor, x, y: tangent(c, a, x), slopeGap: Math.abs(m - n) };
            }).filter(p => p.slopeGap > .04 && Math.abs(p.x) < 4.3 && Math.abs(p.y) < 3.5 && Math.abs(p.x - p.anchor) > .65 && Math.abs(p.x - a) > .4);
            const group = candidates.flatMap((p, i) => candidates.slice(i + 1).flatMap((q, j) => count === 2 ? [[p, q]] : candidates.slice(i + j + 2).map(r => [p, q, r]))).filter(group => group.every((p, i) => group.slice(i + 1).every(q => Math.hypot(p.x - q.x, p.y - q.y) > (count === 2 ? 1.2 : .8)))).sort((p, q) => Math.max(...q.map(p => p.x)) - Math.min(...q.map(p => p.x)) - Math.max(...p.map(p => p.x)) + Math.min(...p.map(p => p.x)))[0];
            if (!group)
                throw new Error('Rendez-vous oblique introuvable');
            anchors = group.map(p => p.anchor);
            targets = group.map((p, i) => target(p.anchor, p.x, i));
        }
        else
            targets = anchors.map((anchor, i) => target(anchor, (a + anchor) / 2, i));
        plan = anchors.map((anchor, i) => ({ a: anchor, direction: 'both', targets: [i] }));
        combination = { a, direction: 'both', targets: targets.map(t => t.id) };
        // A choice of one direction could never cover the opposite sides of this tangent.
    }
    else if (triple && number % 2) {
        const anchors = [h - 2, h - .75, h + 2], xs = [h - 3.5, h + .2, h + 3.5];
        targets = anchors.map((a, i) => target(a, xs[i], i));
        plan = anchors.map((a, i) => ({ a, direction: directionFor(a, xs[i]), targets: [i] }));
    }
    else {
        const left = h - 1.5, right = h + (varied ? .85 : 1.5);
        targets = triple ? [target(left, h - 3.4, 0), target(left, h - 2.3, 1), target(right, h + 3.2, 2)] : [target(left, h - 3.3, 0), target(right, h + (varied ? 3.6 : 3.3), 1)];
        plan = [{ a: left, direction: directionFor(left, targets[0].x), targets: triple ? [0, 1] : [0] }, { a: right, direction: directionFor(right, targets.at(-1).x), targets: [triple ? 2 : 1] }];
    }
    const boss = number === 11;
    if (boss) {
        const hp = world - 1;
        const anchors = [-1.5, 1.5, -.75, 1.75, 0].slice(0, hp).map(a => a + h);
        const xs = [-3.3, 3.3, -2.7, 2.7, -2.3].slice(0, hp).map(x => x + h);
        const stages = anchors.map((a, i) => ({ x: xs[i], y: tangent(c, a, xs[i]), anchor: a }));
        targets = [{ ...target(anchors[0], xs[0], 0), hp, boss: true, stages, radius: .28, motion: .18 }];
        plan = anchors.map((a, i) => ({ a, direction: xs[i] < a ? 'left' : 'right', targets: [0], stage: i }));
        combination = undefined;
        if (world > 4) {
            targets.push({ ...target(h, h + 2.4, 1), motion: .12 }, { ...target(h + 1, h - 1.8, 2), motion: .12 });
            plan.push({ a: h, direction: 'right', targets: [1] }, { a: h + 1, direction: 'left', targets: [2] });
        }
    }
    else if (world >= 5 && number >= 8) {
        targets[0].hp = 2;
        plan = plan.flatMap(s => Array.from({ length: Math.max(...s.targets.map(id => targets[id].hp ?? 1)) }, () => ({ ...s })));
    }
    const obstacles = world === 6 ? [plan[0], plan.at(-1)].map((s, i) => {
        const origin = curvePoint(c, s.a), v = unitTangent(c, s.a), sign = s.direction === 'left' ? -1 : 1, side = i ? -1 : 1;
        const normal = { x: -v.y * side, y: v.x * side };
        if (combination) {
            const p = curvePoint(c, combination.a), u = unitTangent(c, combination.a);
            const x = origin.x + sign * v.x * .75 + normal.x * .55, y = origin.y + sign * v.y * .75 + normal.y * .55;
            if (Math.abs((x - p.x) * u.y - (y - p.y) * u.x) < .32) {
                normal.x *= -1;
                normal.y *= -1;
            }
        }
        return { x: origin.x + sign * v.x * .75 + normal.x * .55, y: origin.y + sign * v.y * .75 + normal.y * .55, radius: .24, motionX: normal.x * .8, motionY: normal.y * .8, phase: i * Math.PI };
    }) : [];
    const par = rendezvous ? Math.max(...targets.map(resistance)) : plan.length;
    const names = rendezvous ? ['Le rendez-vous', 'Un tir ou deux ?', 'L’alignement fugitif'] : triple ? ['Trois éclats', 'Chacun sa tangente', 'Répartis tes tirs'] : ['Deux trajectoires', 'À gauche puis à droite', 'Des cibles indépendantes'];
    return { id, world, number, title: boss ? ['Le premier gardien', 'Le gardien des croisements', 'Le cœur instable'][world - 4] : varied ? ['Rendez-vous oblique', 'L’onde décalée', 'Deux hauteurs', 'L’autre versant', 'La courbe en S', 'Au-delà du sommet'][number - 5] : names[number % names.length], curve: c, solution: plan[0].a,
        solutionDirection: plan[0].direction, rule: boss ? 'choose' : rendezvous ? 'both' : rule, targets, obstacles, par, plan, combination,
        shots: Math.max(3, plan.length + 1), seconds: world === 6 && number % 3 === 2 ? boss ? 60 : 35 : 0,
        instruction: boss ? 'Le gardien change de position à chaque impact. Détruis-le !' : targets.some(t => (t.hp ?? 1) > 1) ? 'La cible blindée demande deux impacts. Répartis tes tirs.' : rendezvous ? 'Attends leur alignement ou répartis tes tirs sur plusieurs tangentes.' : triple ? 'Trois cibles sur plusieurs tangentes. Répartis tes tirs.' : 'Ces deux cibles demandent deux tangentes différentes.' };
}
export function movingTarget(level, t, time, damage = 0) {
    const stage = t.stages?.[Math.min(damage, t.stages.length - 1)] ?? t;
    if (level.curve.kind === 'parametric') {
        const v = unitTangent(level.curve, stage.anchor ?? level.solution), distance = t.motion * Math.sin(time * .85 + t.phase);
        return { x: stage.x + v.x * distance, y: stage.y + v.y * distance };
    }
    const x = stage.x + t.motion * Math.sin(time * .85 + t.phase);
    return { x, y: stage.y + derivative(level.curve, stage.anchor ?? level.solution) * (x - stage.x) };
}
export const resistance = (t) => t.hp ?? 1;
export function movingObstacle(o, time) {
    const wave = Math.sin(time * .85 + (o.phase ?? 0));
    return { x: o.x + (o.motionX ?? 0) * wave, y: o.y + (o.motionY ?? 0) * wave };
}
export const hasMotion = (level) => level.targets.some(t => t.motion) || level.obstacles.some(o => o.motionX || o.motionY);
/** Fit the useful part of the graph without stretching either coordinate axis. */
export function projection(level, width, height) {
    const compact = height < 350, short = height < 210;
    const parametric = level.curve.kind === 'parametric';
    const top = parametric ? compact ? 48 : 80 : compact ? 31 : 47, bottom = compact ? 24 : 35;
    const [start, end] = parameterRange(level.curve);
    const curveYs = parametric ? Array.from({ length: 181 }, (_, i) => curvePoint(level.curve, start + (end - start) * i / 180).y) : [];
    const ys = [0, ...curveYs, ...level.plan.map(s => curvePoint(level.curve, s.a).y), ...level.obstacles.flatMap(o => [o.y - o.radius - (o.motionY ?? 0), o.y + o.radius + (o.motionY ?? 0)]), ...level.targets.flatMap(t => (t.stages ?? [t]).flatMap(stage => {
            const dy = (parametric ? t.motion : Math.abs(derivative(level.curve, stage.anchor ?? level.solution) * t.motion)) + t.radius;
            return [stage.y - dy, stage.y + dy];
        }))];
    const low = Math.min(...ys), high = Math.max(...ys);
    const span = Math.max(short ? 3 : compact ? 5.5 : 8, high - low + 1.3);
    const scale = Math.min((width - 38) / 11, (height - top - bottom) / span);
    const center = { x: width / 2, y: top + (height - top - bottom) / 2 + (high + low) / 2 * scale };
    return { scale, center, top, bottom };
}
/** Positive distance along an oriented ray, or null if the circle is not intersected. */
export function rayCircle(origin, unit, center, radius) {
    const dx = center.x - origin.x, dy = center.y - origin.y;
    const along = dx * unit.x + dy * unit.y;
    // Cross product with the unit direction gives the center-to-line distance
    // without subtracting two potentially large, nearly equal squares.
    const distance = Math.abs(dx * unit.y - dy * unit.x);
    const tolerance = 32 * Number.EPSILON * Math.max(1, Math.abs(dx), Math.abs(dy), radius);
    if (distance > radius + tolerance)
        return null;
    const half = Math.sqrt(Math.max(0, (radius - distance) * (radius + distance)));
    if (along + half < 0)
        return null;
    return Math.max(0, along - half);
}
export function fire(level, a, direction, time, damage = new Map()) {
    const origin = curvePoint(level.curve, a), slope = derivative(level.curve, a), vector = unitTangent(level.curve, a);
    const impacts = new Map(), obstacleHits = new Set(), beams = [];
    const signs = direction === 'both' ? [-1, 1] : direction === 'left' ? [-1] : [1];
    for (const sign of signs) {
        const unit = { x: sign * vector.x, y: sign * vector.y };
        let stop = 35, obstacleId = -1;
        level.obstacles.forEach((o, i) => { const d = rayCircle(origin, unit, movingObstacle(o, time), o.radius); if (d !== null && d < stop) {
            stop = d;
            obstacleId = i;
        } });
        if (obstacleId >= 0)
            obstacleHits.add(obstacleId);
        for (const t of level.targets) {
            if ((damage.get(t.id) ?? 0) >= resistance(t))
                continue;
            const center = movingTarget(level, t, time, damage.get(t.id) ?? 0), d = rayCircle(origin, unit, center, t.radius);
            if (d !== null && d < stop - 1e-8) {
                const along = Math.max(0, Math.min(stop, (center.x - origin.x) * unit.x + (center.y - origin.y) * unit.y));
                const distance = Math.hypot(center.x - origin.x - unit.x * along, center.y - origin.y - unit.y * along);
                const precision = Math.max(0, Math.min(1, 1 - distance / t.radius));
                impacts.set(t.id, Math.max(impacts.get(t.id) ?? 0, precision));
            }
        }
        beams.push({ end: { x: origin.x + unit.x * stop, y: origin.y + unit.y * stop }, blocked: obstacleId >= 0 });
    }
    return { origin, vector, slope, hits: [...impacts.keys()], obstacleHits: [...obstacleHits], impacts: [...impacts].map(([id, precision]) => ({ id, precision })), beams };
}
export const ruleLabel = (rule, c) => c?.kind === 'parametric' ? ({ both: '↔ Deux sens', left: '← Sens inverse', right: 'Sens du parcours →', choose: '← Sens du tir →' })[rule] : ({ both: '↔ Double rayon', left: '← Vers la gauche', right: 'Vers la droite →', choose: '← Sens au choix →' })[rule];
