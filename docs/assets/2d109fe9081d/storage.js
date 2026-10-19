import { LEVELS_PER_WORLD, resistance, TOTAL_LEVELS, WORLDS } from './engine.js';
export const MAX_LIVES = 3;
const freshStats = () => ({ hits: 0, destroyed: 0, armored: 0, moving: 0, doubleShots: 0, tripleShots: 0, leftHits: 0, rightHits: 0, bothHits: 0, worldRestarts: 0, livesLost: 0, bosses: [], cleanBosses: [] });
const KEY = 'tangent-strike-v1';
export const freshSave = () => ({ version: 2, stars: Array(TOTAL_LEVELS).fill(0), attempts: 0, wins: 0, perfect: 0, doubles: 0, streak: 0, bestStreak: 0, sound: true, reducedMotion: false, lastLevel: 0, runs: WORLDS.map(() => ({ next: 0, lives: MAX_LIVES, cleared: false, seed: 0 })), unlockedWorld: 0, activeAttempt: null, stats: freshStats() });
const integer = (n, min, max, fallback = min) => Number.isSafeInteger(n) && Number(n) >= min && Number(n) <= max ? Number(n) : fallback;
export function readSave(storage = localStorage) {
    try {
        const data = JSON.parse(storage.getItem(KEY) || 'null');
        if (!data || (data.version !== 1 && data.version !== 2))
            return freshSave();
        const save = freshSave();
        save.stars = save.stars.map((_, i) => Number.isInteger(data.stars?.[i]) ? Math.min(3, Math.max(0, data.stars[i])) : 0);
        for (const key of ['attempts', 'wins', 'perfect', 'doubles', 'streak', 'bestStreak'])
            save[key] = integer(data[key], 0, Number.MAX_SAFE_INTEGER);
        for (const key of ['sound', 'reducedMotion'])
            if (typeof data[key] === 'boolean')
                save[key] = data[key];
        for (const key of ['hits', 'destroyed', 'armored', 'moving', 'doubleShots', 'tripleShots', 'leftHits', 'rightHits', 'bothHits', 'worldRestarts', 'livesLost'])
            save.stats[key] = integer(data.stats?.[key], 0, Number.MAX_SAFE_INTEGER);
        for (const key of ['bosses', 'cleanBosses'])
            save.stats[key] = Array.isArray(data.stats?.[key]) ? [...new Set(data.stats[key].filter((id) => [59, 71, 83].includes(id)))] : [];
        save.lastLevel = integer(data.lastLevel, 0, TOTAL_LEVELS - 1);
        if (data.version === 2) {
            save.runs = save.runs.map((run, i) => {
                const r = data.runs?.[i];
                return r ? { next: integer(r.next, 0, 12), lives: integer(r.lives, 0, MAX_LIVES, MAX_LIVES), cleared: r.cleared === true, seed: integer(r.seed, 0, 1_000_000) } : run;
            });
            save.unlockedWorld = integer(data.unlockedWorld, 0, WORLDS.length - 1);
            save.activeAttempt = data.activeAttempt === null ? null : integer(data.activeAttempt, 0, TOTAL_LEVELS - 1, -1);
            if (save.activeAttempt === -1)
                save.activeAttempt = null;
        }
        else {
            // Keep existing records and access when upgrading the original 60-level campaign.
            for (let w = 0; w < WORLDS.length; w++) {
                const stars = save.stars.slice(w * 12, w * 12 + 12);
                const firstMissing = stars.findIndex(s => !s);
                save.runs[w].next = firstMissing < 0 ? 12 : firstMissing;
                save.runs[w].cleared = firstMissing < 0;
                if (w < 5 && (stars.filter(Boolean).length >= 8 || save.runs[w].cleared))
                    save.unlockedWorld = Math.max(save.unlockedWorld, Math.min(w + 1, WORLDS.length - 1));
            }
            save.unlockedWorld = Math.max(save.unlockedWorld, Math.floor(Math.min(59, save.lastLevel) / 12));
        }
        if (!levelUnlocked(save, save.lastLevel))
            save.lastLevel = resumeLevel(save, Math.min(save.unlockedWorld, Math.floor(save.lastLevel / 12)));
        return save;
    }
    catch {
        return freshSave();
    }
}
export function writeSave(save) { try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
}
catch {
    return false;
} }
export function worldUnlocked(save, world) { return world >= 0 && world < WORLDS.length && (world <= save.unlockedWorld || (world > 0 && save.runs[world - 1].cleared)); }
export function levelUnlocked(save, id) { return Number.isInteger(id) && id >= 0 && id < TOTAL_LEVELS && worldUnlocked(save, Math.floor(id / 12)) && id % 12 <= save.runs[Math.floor(id / 12)].next; }
export function resumeLevel(save, world) { return world * LEVELS_PER_WORLD + Math.min(11, save.runs[world].next); }
export function loseLife(save, world) {
    const run = save.runs[world];
    if (run.lives > 0)
        save.stats.livesLost++;
    run.lives = Math.max(0, run.lives - 1);
    save.streak = 0;
    if (run.lives === 0) {
        run.next = 0;
        save.lastLevel = world * 12;
        save.activeAttempt = null;
    }
    return run.lives === 0;
}
export function failAttempt(save, id, collisionAlreadyCharged = false) {
    save.activeAttempt = null;
    return collisionAlreadyCharged ? save.runs[Math.floor(id / 12)].lives === 0 : loseLife(save, Math.floor(id / 12));
}
export function restartWorld(save, world) {
    const run = save.runs[world];
    run.next = 0;
    run.lives = MAX_LIVES;
    run.seed = (run.seed + 1) % 1_000_001;
    save.stats.worldRestarts++;
    save.lastLevel = world * 12;
    save.activeAttempt = null;
}
export function recoverInterruptedAttempt(save) {
    if (save.activeAttempt === null)
        return false;
    const id = save.activeAttempt;
    failAttempt(save, id);
    return true;
}
export function award(save, id, shotsUsed, assisted, double, precision = 1, par = 1, collisions = 0) {
    save.activeAttempt = null;
    if (assisted)
        return 0;
    const stars = shotsUsed <= par && precision >= .8 - 1e-9 && collisions === 0 ? 3 : shotsUsed <= par + 1 && precision >= .45 - 1e-9 ? 2 : 1;
    save.stars[id] = Math.max(save.stars[id], stars);
    save.wins++;
    save.streak++;
    save.bestStreak = Math.max(save.bestStreak, save.streak);
    if (stars === 3)
        save.perfect++;
    if (double)
        save.doubles++;
    if (id >= 48 && id % 12 === 11) {
        if (!save.stats.bosses.includes(id))
            save.stats.bosses.push(id);
        if (!collisions && !save.stats.cleanBosses.includes(id))
            save.stats.cleanBosses.push(id);
    }
    const world = Math.floor(id / 12), run = save.runs[world];
    if (id % 12 === run.next)
        run.next++;
    if (run.next === 12) {
        run.cleared = true;
        save.unlockedWorld = Math.max(save.unlockedWorld, Math.min(world + 1, WORLDS.length - 1));
    }
    return stars;
}
export function recordImpacts(save, level, result, direction, killed) {
    const stats = save.stats;
    stats.hits += result.hits.length;
    stats.destroyed += killed.length;
    if (result.hits.length >= 2)
        stats.doubleShots++;
    if (result.hits.length >= 3)
        stats.tripleShots++;
    stats[direction === 'left' ? 'leftHits' : direction === 'right' ? 'rightHits' : 'bothHits'] += result.hits.length;
    for (const id of killed) {
        const t = level.targets.find(t => t.id === id);
        if (resistance(t) > 1 && !t.boss)
            stats.armored++;
        if (t.motion)
            stats.moving++;
    }
}
export function achievements(save) {
    const unique = save.stars.filter(Boolean).length, perfect = save.stars.filter(n => n === 3).length, stars = save.stars.reduce((a, b) => a + b, 0), cleared = save.runs.filter(r => r.cleared).length;
    const out = [];
    const add = (id, category, name, text, icon, count, goal) => out.push({ id, category, name, text, icon, done: count >= goal, value: Math.min(goal, Math.max(0, count)), goal });
    add('first', 'Parcours', 'Premier éclat', 'Réussir un premier niveau', '✧', save.wins, 1);
    for (const [goal, name] of [[5, 'Apprenti des courbes'], [12, 'Une ligne claire'], [24, 'Tireur confirmé'], [42, 'Cartographe'], [60, 'Aux frontières'], [84, 'Collection complète']])
        add(`levels-${goal}`, 'Parcours', name, `Réussir ${goal} niveaux différents`, '↗', unique, goal);
    const names = ['Roi des extrema', 'Maître des pentes', 'Double maîtrise', 'Passage sûr', 'Laser Master', 'Au croisement', 'Champ maîtrisé'];
    save.runs.forEach((r, i) => add(`world-${i}`, 'Parcours', names[i], `Terminer ${WORLDS[i].name}`, WORLDS[i].icon, r.cleared ? 12 : r.next, 12));
    add('supreme', 'Parcours', 'Dérivée suprême', 'Terminer les sept mondes', '✦', cleared, 7);
    add('two-worlds', 'Parcours', 'Deux horizons', 'Terminer deux mondes', '↔', cleared, 2);
    add('four-worlds', 'Parcours', 'Quatre horizons', 'Terminer quatre mondes', '◇', cleared, 4);
    add('restart', 'Parcours', 'Persévérance', 'Recommencer un monde', '↻', save.stats.worldRestarts, 1);
    add('last-world', 'Parcours', 'Dernière frontière', 'Ouvrir le septième monde', '⟁', save.unlockedWorld, 6);
    add('first-stars', 'Parcours', 'Première constellation', 'Réunir 12 étoiles', '★', stars, 12);
    for (const [goal, name] of [[1, 'Plein centre'], [5, 'Le bon viseur'], [10, 'Précision lumineuse'], [20, 'Tireur d’élite'], [40, 'Atelier de lumière'], [84, 'Zénith']])
        add(`perfect-${goal}`, 'Précision', name, `Obtenir trois étoiles sur ${goal} niveau${goal > 1 ? 'x différents' : ''}`, '⌖', goal === 20 ? Math.max(perfect, Math.min(20, save.perfect)) : perfect, goal);
    for (const goal of [50, 100, 150, 200])
        add(`stars-${goal}`, 'Précision', `${goal} étoiles`, `Réunir ${goal} étoiles`, '★', stars, goal);
    add('horizontal-perfect', 'Précision', 'L’horizontale parfaite', 'Trois étoiles aux 12 niveaux du premier monde', '↔', save.stars.slice(0, 12).filter(s => s === 3).length, 12);
    add('perfect-worlds', 'Précision', 'Tout le spectre', 'Trois étoiles dans chacun des sept mondes', '✧', save.runs.filter((_, i) => save.stars.slice(i * 12, i * 12 + 12).includes(3)).length, 7);
    add('double', 'Combats', 'Double destruction', 'Finir un niveau en détruisant plusieurs cibles du même tir', '◎', save.doubles, 1);
    add('double-ten', 'Combats', 'Deux par deux', 'Réussir 10 tirs à impacts multiples', '◎', save.stats.doubleShots, 10);
    add('triple', 'Combats', 'Triple impact', 'Toucher trois cibles du même tir', '✦', save.stats.tripleShots, 1);
    add('triple-five', 'Combats', 'Constellation en rafale', 'Réussir cinq triples impacts', '✦', save.stats.tripleShots, 5);
    add('armor', 'Combats', 'Premier blindage', 'Détruire une cible blindée', '◇', save.stats.armored, 1);
    add('armor-ten', 'Combats', 'Brise-blindage', 'Détruire 10 cibles blindées', '◇', save.stats.armored, 10);
    add('moving-ten', 'Combats', 'Cibles insaisissables', 'Détruire 10 cibles mobiles', '↝', save.stats.moving, 10);
    add('hits-hundred', 'Combats', 'Cent impacts', 'Infliger 100 impacts', 'ϟ', save.stats.hits, 100);
    add('hits-five-hundred', 'Combats', 'Cinq cents éclats', 'Infliger 500 impacts', 'ϟ', save.stats.hits, 500);
    add('boss-first', 'Combats', 'Un gardien tombe', 'Vaincre un gardien', '♔', save.stats.bosses.length, 1);
    add('boss-all', 'Combats', 'Les trois gardiens', 'Vaincre les trois gardiens différents', '♔', save.stats.bosses.length, 3);
    add('boss-clean', 'Combats', 'Bouclier intact', 'Vaincre un gardien sans collision dans le niveau', '♡', save.stats.cleanBosses.length, 1);
    add('streak-three', 'Maîtrise', 'Sur la lancée', 'Réussir trois niveaux sans échec', 'ϟ', save.bestStreak, 3);
    add('streak-ten', 'Maîtrise', 'Sans faute', 'Réussir 10 niveaux sans échec', 'ϟ', save.bestStreak, 10);
    add('streak-twenty', 'Maîtrise', 'Longue trajectoire', 'Réussir 20 niveaux sans échec', 'ϟ', save.bestStreak, 20);
    add('left-ten', 'Maîtrise', 'Main gauche', 'Toucher 10 cibles en tirant vers la gauche', '←', save.stats.leftHits, 10);
    add('right-ten', 'Maîtrise', 'Main droite', 'Toucher 10 cibles en tirant vers la droite', '→', save.stats.rightHits, 10);
    add('both-twenty', 'Maîtrise', 'L’équilibre', 'Toucher 20 cibles en double rayon', '↔', save.stats.bothHits, 20);
    return out;
}
