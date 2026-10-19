import { TOTAL_LEVELS } from './engine.js';
const KEY = 'tangent-strike-v1';
export const freshSave = () => ({ version: 1, stars: Array(TOTAL_LEVELS).fill(0), attempts: 0, wins: 0, perfect: 0, doubles: 0, streak: 0, bestStreak: 0, sound: true, reducedMotion: false, lastLevel: 0 });
export function readSave(storage = localStorage) {
    try {
        const data = JSON.parse(storage.getItem(KEY) || 'null');
        if (!data || data.version !== 1)
            return freshSave();
        const save = freshSave();
        save.stars = save.stars.map((_, i) => Number.isInteger(data.stars?.[i]) ? Math.min(3, Math.max(0, data.stars[i])) : 0);
        for (const key of ['attempts', 'wins', 'perfect', 'doubles', 'streak', 'bestStreak'])
            save[key] = Number.isSafeInteger(data[key]) ? Math.max(0, data[key]) : 0;
        for (const key of ['sound', 'reducedMotion'])
            if (typeof data[key] === 'boolean')
                save[key] = data[key];
        save.lastLevel = Number.isInteger(data.lastLevel) && data.lastLevel >= 0 && data.lastLevel < TOTAL_LEVELS ? data.lastLevel : 0;
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
export function worldUnlocked(save, world) { return world === 0 || save.stars.slice((world - 1) * 12, world * 12).filter(s => s > 0).length >= 8; }
export function award(save, id, shotsUsed, assisted, double, precision = 1) {
    const stars = assisted ? 1 : shotsUsed === 1 && precision >= .8 - 1e-9 ? 3 : shotsUsed <= 2 && precision >= .45 - 1e-9 ? 2 : 1;
    save.stars[id] = Math.max(save.stars[id], stars);
    save.wins++;
    save.streak++;
    save.bestStreak = Math.max(save.bestStreak, save.streak);
    if (stars === 3)
        save.perfect++;
    if (double)
        save.doubles++;
    return stars;
}
export const achievements = (save) => [
    { name: 'Premier éclat', text: 'Réussir un premier niveau', icon: '✧', done: save.wins >= 1, value: Math.min(1, save.wins), goal: 1 },
    { name: 'Tireur d’élite', text: '20 réussites avec trois étoiles', icon: '⌖', done: save.perfect >= 20, value: Math.min(20, save.perfect), goal: 20 },
    { name: 'Double destruction', text: 'Détruire deux cibles d’un tir', icon: '◎', done: save.doubles >= 1, value: Math.min(1, save.doubles), goal: 1 },
    { name: 'Roi des extrema', text: 'Terminer le premier monde', icon: '♔', done: save.stars.slice(0, 12).every(s => s > 0), value: save.stars.slice(0, 12).filter(Boolean).length, goal: 12 },
    { name: 'Sans faute', text: '10 niveaux réussis sans échec', icon: 'ϟ', done: save.bestStreak >= 10, value: Math.min(10, save.bestStreak), goal: 10 },
    { name: 'Dérivée suprême', text: 'Terminer les cinq mondes', icon: '✦', done: save.stars.every(s => s > 0), value: save.stars.filter(Boolean).length, goal: TOTAL_LEVELS },
];
