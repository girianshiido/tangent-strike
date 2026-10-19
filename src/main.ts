import { Board, type BoardState } from './board.js';
import { derivative, fire, format, hasMotion, makeLevel, resistance, ruleLabel, TOTAL_LEVELS, WORLDS, type Direction, type Level } from './engine.js';
import { achievements, award, failAttempt, freshSave, levelUnlocked, loseLife, MAX_LIVES, readSave, recordImpacts, recoverInterruptedAttempt, restartWorld, resumeLevel, worldUnlocked, writeSave } from './storage.js';
import { setupInstallation } from './install.js';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let save = readSave();
const interrupted = recoverInterruptedAttempt(save);
let level: Level = makeLevel(save.lastLevel);
let practice = false, variant = 0, destroyed = new Set<number>(), used = 0, busy = false, finished = false, assisted = false;
let hint: number | null = null, damage = new Map<number, number>();
let direction: Direction = 'both', aim: number | null = null, shot: BoardState['shot'] = null;
let impactPrecision = new Map<number, number>();
let collisions = 0;
let elapsed = 0, targetTime = 0, timerStarted = false, token = 0, raf = 0, previous = performance.now(), lastPaint = 0;
let soundContext: AudioContext | null = null, storageWarning = false, toastTimer = 0;
const dialog = $<HTMLDialogElement>('#modal');
const canvas = $<HTMLCanvasElement>('#board');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const state = (): BoardState => ({level, destroyed, damage, time: targetTime, aim, shot, hint, reducedMotion: save.reducedMotion || motionPreference.matches});
const board = new Board(canvas, state, () => requestDraw());
function persist() {
  if (!writeSave(save) && !storageWarning) {storageWarning = true;$('#save-caption').textContent = 'Sauvegarde indisponible dans ce navigateur';notify('La sauvegarde est indisponible. Garde cette fenêtre ouverte pour conserver ta session.');}
}
function notify(message: string) {$('#toast').textContent = message;$('#toast').hidden = false;clearTimeout(toastTimer);toastTimer = window.setTimeout(() => {$('#toast').hidden = true;}, 3600);}
function show(title: string, html: string) {
  $('#modal-content').innerHTML = `<h2>${title}</h2>${html}`;
  if (!dialog.open) dialog.showModal();
}
function closeModal() {dialog.close();previous = performance.now();requestDraw();}
$('#close-modal').addEventListener('click', closeModal);
dialog.addEventListener('click', event => {if (event.target === dialog) {const r = dialog.getBoundingClientRect();if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal();}});
dialog.addEventListener('close', () => {previous = performance.now();requestDraw();});
function playTone(type: 'shot' | 'hit' | 'win') {
  if (!save.sound) return;
  try {
    soundContext ??= new AudioContext();void soundContext.resume();
    const time = soundContext.currentTime;
    const notes = type === 'win' ? [523.25, 659.25, 783.99] : type === 'hit' ? [659.25, 987.77] : [440];
    notes.forEach((f, i) => {
      const oscillator = soundContext!.createOscillator(), gain = soundContext!.createGain();
      oscillator.type = 'sine';oscillator.frequency.setValueAtTime(f, time + i * .08);
      if (type === 'shot') oscillator.frequency.exponentialRampToValueAtTime(120, time + .16);
      gain.gain.setValueAtTime(0, time + i * .08);gain.gain.linearRampToValueAtTime(.055, time + i * .08 + .012);gain.gain.exponentialRampToValueAtTime(.001, time + i * .08 + .2);
      oscillator.connect(gain);gain.connect(soundContext!.destination);oscillator.start(time + i * .08);oscillator.stop(time + i * .08 + .22);
    });
  } catch { /* Gameplay remains available without Web Audio. */ }
}
function updateSound() {const b = $('#sound');b.textContent = save.sound ? '♫' : '♪';b.setAttribute('aria-label', save.sound ? 'Désactiver le son' : 'Activer le son');b.setAttribute('aria-pressed', String(save.sound));}
$('#sound').addEventListener('click', () => {save.sound = !save.sound;persist();updateSound();});
function updateCampaign() {
  const count = save.stars.filter(Boolean).length;
  $('#campaign-count').textContent = `${String(count).padStart(2, '0')} / ${TOTAL_LEVELS}`;
  $('#campaign-progress').style.width = `${count / TOTAL_LEVELS * 100}%`;
  $('#worlds').innerHTML = WORLDS.map((w, i) => {
    const open = practice || worldUnlocked(save, i), won = save.runs[i].next;
    return `<button class="world-card ${i === level.world ? 'active' : ''} ${open ? '' : 'locked'}" data-world="${i}" aria-label="Monde ${i + 1} : ${w.name}${open ? '' : ', verrouillé'}" aria-current="${i === level.world ? 'true' : 'false'}" style="--world:${w.color}"><span class="world-icon" aria-hidden="true">${w.icon}</span><span><small>MONDE 0${i + 1}</small><strong>${w.name}</strong></span><span class="world-status">${open ? `${won}/12` : '⌑'}</span></button>`;
  }).join('');
  $('#levels').innerHTML = Array.from({length: 12}, (_, i) => {
    const id = level.world * 12 + i, stars = save.stars[id];
    const open = practice || levelUnlocked(save, id);
    return `<button class="level-chip ${id === level.id ? 'current' : ''} ${stars ? 'complete' : ''}" data-level="${id}" ${open ? '' : 'disabled'} aria-label="Niveau ${i + 1}${stars ? `, record : ${stars} étoiles` : ''}${open ? '' : ', à débloquer'}" aria-current="${id === level.id ? 'step' : 'false'}">${String(i + 1).padStart(2, '0')}</button>`;
  }).join('');
  $('#achievement-count').textContent = `${achievements(save).filter(a => a.done).length} / 50`;
  $('#practice').classList.toggle('active', practice);
}
function updateControls() {
  const lives = save.runs[level.world].lives;
  $('#health').innerHTML = practice ? '<span>∞</span>' : Array.from({length: MAX_LIVES}, (_, i) => `<span class="${i >= lives ? 'lost' : ''}">${i < lives ? '♥' : '♡'}</span>`).join('');
  $('#health').setAttribute('aria-label', practice ? 'Laboratoire : vies illimitées' : `${lives} points de vie sur ${MAX_LIVES}`);
  $('#shots').innerHTML = practice ? '<span aria-label="Tirs illimités">∞</span>' : level.shots > 4 ? `<span class="numeric-shots">${Math.max(0, level.shots - used)}<small> / ${level.shots}</small></span>` : Array.from({length: level.shots}, (_, i) => `<i class="energy-cell ${i < used ? 'spent' : ''}" aria-hidden="true"></i>`).join('');
  $('#shots').setAttribute('aria-label', practice ? 'Tirs illimités' : `${level.shots - used} tirs restants`);
  $('#shots-label').textContent = practice ? 'TIRS LIBRES' : 'ÉNERGIE';
  $('#direction-control').hidden = level.rule !== 'choose';
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-direction]')) {b.classList.toggle('selected', b.dataset.direction === direction);b.setAttribute('aria-pressed', String(b.dataset.direction === direction));b.disabled = busy || finished;}
  $<HTMLButtonElement>('#hint').disabled = busy || finished;
  $('#timer').hidden = !level.seconds || practice;
  updateTimer();
  $('#mode-badge').textContent = practice ? 'LABORATOIRE' : 'CAMPAGNE';
  const total = level.targets.reduce((sum, t) => sum + resistance(t), 0), taken = [...damage.values()].reduce((a, b) => a + b, 0);
  $('#coordinates').textContent = `${taken}/${total} IMPACTS`;
}
function updateTimer() {
  const left = Math.max(0, Math.ceil(level.seconds - elapsed));
  if ($('#timer span').textContent !== String(left)) {$('#timer span').textContent = String(left);$('#timer').classList.toggle('urgent', left <= 5);}
}
function feedback(html: string, symbol = '↗') {$('#feedback').innerHTML = `<span class="feedback-symbol" aria-hidden="true">${symbol}</span><p>${html}</p>`;}
function startLevel(id: number, nextVariant = 0) {
  if (!practice && !levelUnlocked(save, id)) {notify('Réussis le niveau précédent pour avancer dans ce monde.');return;}
  if (save.activeAttempt !== null) {
    const abandoned = save.activeAttempt, died = failAttempt(save, abandoned);
    if (died && !practice) id = Math.floor(abandoned / 12) * 12;
    if (!died) notify('Essai abandonné : une vie perdue.');persist();
  }
  const v = practice ? nextVariant : save.runs[Math.floor(id / 12)].seed;
  token++;level = makeLevel(id, v);variant = v;destroyed = new Set();damage = new Map();impactPrecision = new Map();collisions = 0;used = 0;busy = false;finished = false;assisted = false;hint = null;aim = null;shot = null;elapsed = 0;targetTime = 0;timerStarted = false;previous = performance.now();
  direction = level.rule === 'choose' ? 'right' : level.rule;
  if (!practice) {save.lastLevel = id;persist();}
  document.documentElement.style.setProperty('--world', WORLDS[level.world].color);
  $('#world-caption').textContent = `${practice ? 'LABORATOIRE' : `MONDE 0${level.world + 1}`} / ${WORLDS[level.world].name.toLocaleUpperCase('fr')}`;
  $('#level-title').textContent = level.title;
  $('#level-number').innerHTML = `${String(level.number + 1).padStart(2, '0')}<span> / 12</span>`;
  $('#instruction').textContent = level.instruction;
  $('#mission-detail').textContent = level.rule === 'choose' ? 'Choisis ← ou →, puis touche la courbe.' : 'Touche la courbe. Glisse pour affiner, relâche pour tirer.';
  $('#function').textContent = level.curve.label;$('#direction-badge').textContent = ruleLabel(level.rule);
  $('#obstacle-legend').hidden = level.obstacles.length === 0;
  $('#first-tip').hidden = id !== 0 || save.stars[0] > 0 || practice;
  $('#first-tip span').textContent = level.curve.scale < 0 ? 'Touche le sommet de la courbe' : 'Touche le creux de la courbe';
  $('#result').hidden = true;$('#result').innerHTML = '';
  $('#arena').dataset.level = String(id);
  canvas.setAttribute('aria-label', `${level.curve.label}. ${level.instruction} ${ruleLabel(level.rule)}. Au clavier : flèches pour viser, Entrée pour tirer.`);
  feedback(level.seconds && !practice ? `Défi de ${level.seconds} secondes, dès ton premier geste. Objectif : ${level.par} tirs.` : practice ? 'Tirs et vies illimités. Les solutions ne valident pas la campagne.' : `Objectif : ${level.par} tir${level.par > 1 ? 's' : ''}. Obstacle touché ou échec : −1 vie.`);
  updateCampaign();updateControls();requestDraw();
  if (!practice && save.runs[level.world].lives === 0) finish(false, false, true);
}
$('#worlds').addEventListener('click', event => {
  const b = (event.target as HTMLElement).closest<HTMLElement>('[data-world]');if (!b) return;
  const world = Number(b.dataset.world);
  if (!practice && !worldUnlocked(save, world)) {
    const count = save.runs[world - 1].next;
    show('Un monde à découvrir.', `<p>Termine les <strong>12 niveaux</strong> du monde précédent pour ouvrir ${WORLDS[world].name}. Progression actuelle : ${count}/12.</p><p>Tu peux aussi explorer ce monde dans le <strong>laboratoire libre</strong>.</p><button class="primary-button" id="try-world">Explorer ce monde ↗</button>`);
    $('#try-world').addEventListener('click', () => {practice = true;closeModal();startLevel(world * 12);});return;
  }
  startLevel(resumeLevel(save, world));
});
$('#levels').addEventListener('click', event => {const b = (event.target as HTMLElement).closest<HTMLElement>('[data-level]');if (b) startLevel(Number(b.dataset.level));});
$('#retry').addEventListener('click', () => startLevel(level.id, variant));
$('#direction-control').addEventListener('click', event => {const b = (event.target as HTMLElement).closest<HTMLElement>('[data-direction]');if (b && !busy && !finished) {direction = b.dataset.direction as Direction;updateControls();}});
function finish(win: boolean, double = false, collisionAlreadyCharged = false) {
  if (finished) return;
  finished = true;busy = false;
  let stars = 0;
  const precision = impactPrecision.size ? Math.min(...impactPrecision.values()) : 0;
  const completedBefore = save.runs.every(r => r.cleared);
  const before = achievements(save).filter(a => a.done).length;
  if (!practice) {
    if (win) stars = award(save, level.id, used, assisted, double, precision, level.par, collisions);
    else failAttempt(save, level.id, collisionAlreadyCharged);
    persist();
  }
  const after = achievements(save).filter(a => a.done).length;
  updateCampaign();updateControls();
  const allDone = !practice && !completedBefore && save.runs.every(r => r.cleared);
  const dead = !practice && save.runs[level.world].lives === 0;
  const grade = precision >= .8 - 1e-9 ? 'Plein centre.' : precision >= .45 - 1e-9 ? 'Tir précis.' : level.targets.length > 1 ? 'Cibles touchées.' : 'Cible touchée.';
  const centering = `Centrage : ${Math.round(precision * 100)} % · ${used} tir${used > 1 ? 's' : ''}.`;
  $('#result').innerHTML = `<div class="result-mark" aria-hidden="true">${dead ? '♡' : win ? '✦' : '↻'}</div>${win && !practice ? `<div class="stars" aria-label="${stars} étoile${stars > 1 ? 's' : ''}">${Array.from({length: 3}, (_, i) => `<span class="${i < stars ? '' : 'empty'}">★</span>`).join('')}</div>` : ''}<h3>${dead ? 'Bouclier épuisé.' : allDone ? 'Dérivée suprême !' : win ? collisions ? 'Objectif atteint.' : grade : 'Ajuste ta trajectoire.'}</h3><p>${dead ? 'Retour au premier niveau du monde avec trois vies et de nouvelles variations. Tes records d’étoiles sont conservés.' : allDone ? `Les ${TOTAL_LEVELS} défis sont réussis. Reviens chercher les trois étoiles ou explore le laboratoire.` : win ? `${centering} ${collisions ? 'Collision : une vie perdue, trois étoiles impossibles.' : practice ? 'Le laboratoire ne valide pas la campagne.' : after > before ? 'Un nouveau succès est débloqué !' : save.runs[level.world].next === 12 ? 'Monde terminé ! Le suivant est ouvert.' : precision < .8 ? 'Vise le centre pour améliorer tes étoiles.' : 'Un rayon au plus près du centre de chaque cible.'}` : `${elapsed >= level.seconds && level.seconds > 0 ? 'Le temps est écoulé.' : 'Les tirs sont épuisés.'} ${collisionAlreadyCharged ? 'La collision a coûté une vie.' : 'Une vie perdue.'} Il reste ${save.runs[level.world].lives} vie${save.runs[level.world].lives > 1 ? 's' : ''}.`}</p><div class="result-buttons"><button class="primary-button" id="result-next">${dead ? 'Recommencer le monde ↻' : win ? practice ? 'Nouvelle variation ↗' : allDone ? 'Rejouer le monde ↻' : save.runs[level.world].next === 12 && level.world < WORLDS.length - 1 ? 'Monde suivant →' : 'Continuer →' : 'Réessayer ↻'}</button><button class="secondary-button" id="result-replay">${dead ? 'Laboratoire libre' : win ? 'Rejouer' : 'Comprendre la règle'}</button></div>${win && !practice ? `<p class="mini">Objectif : ≤ ${level.par} tirs · ★★★ : plein centre, sans collision</p>` : ''}`;
  $('#result').hidden = false;
  $('#result-next').addEventListener('click', () => {
    if (dead || allDone) {restartWorld(save, level.world);persist();startLevel(level.world * 12);}
    else if (!win) startLevel(level.id, variant);
    else if (practice) startLevel(level.id, variant + 1);
    else {const world = save.runs[level.world].next === 12 ? Math.min(WORLDS.length - 1, level.world + 1) : level.world;startLevel(resumeLevel(save, world));}
  });
  $('#result-replay').addEventListener('click', () => {if (dead) openPractice();else if (!win) openLesson();else startLevel(level.id, variant);});
  if (win) playTone('win');requestDraw();
}
function shoot(a: number) {
  if (busy || finished || dialog.open || (!practice && used >= level.shots)) return;
  $('#first-tip').hidden = true;busy = true;timerStarted = true;aim = null;used++;
  beginAttempt();
  if (!practice) {save.attempts++;persist();}
  const result = fire(level, a, direction, targetTime, damage), thisToken = token;
  const collision = result.obstacleHits.length > 0;
  if (collision) {collisions++;if (!practice) {loseLife(save, level.world);persist();}}
  shot = {result, at: performance.now()};playTone('shot');updateControls();requestDraw();
  const m = result.slope, b = result.origin.y - m * a;
  const equation = `y ≈ ${format(m)}x ${b < 0 ? '−' : '+'} ${format(Math.abs(b))}`;
  const explanation = `<strong>a ≈ ${format(a)} · f′(a) ≈ ${format(m)}</strong> &nbsp;|&nbsp; ${equation}`;
  feedback(collision ? `${explanation}<br>Obstacle touché : ${practice ? 'aucune vie perdue en laboratoire' : '−1 vie'}.` : explanation, collision ? '♡' : 'ϟ');
  window.setTimeout(() => {
    if (thisToken !== token) return;
    const killed: number[] = [];
    if (level.world === 2 && result.hits.length !== level.targets.length) {destroyed.clear();damage.clear();impactPrecision.clear();}
    else {
      result.hits.forEach(id => {const t = level.targets.find(t => t.id === id)!;damage.set(id, Math.min(resistance(t), (damage.get(id) ?? 0) + 1));if (damage.get(id) === resistance(t)) {destroyed.add(id);killed.push(id);}});
      result.impacts.forEach(i => impactPrecision.set(i.id, Math.min(impactPrecision.get(i.id) ?? 1, i.precision)));
    }
    if (!practice) {recordImpacts(save, level, result, direction, killed);persist();}
    hint = null;
    busy = false;
    if (result.hits.length) playTone('hit');
    const blocked = result.beams.some(b => b.blocked);
    if (!practice && save.runs[level.world].lives === 0) finish(false, false, true);
    else if (destroyed.size === level.targets.length) finish(true, result.hits.length >= 2);
    else if (!practice && used >= level.shots) finish(false, false, collision);
    else {
      feedback(`${explanation}<br>${blocked ? `Obstacle touché : ${practice ? 'pas de malus en laboratoire' : '−1 vie'}. Attends ou change de trajectoire.` : level.world === 0 && Math.abs(m) > .065 ? 'Dans ce monde, cherche une pente nulle : f′(a) = 0.' : level.world === 2 ? 'Les deux cibles doivent être touchées par le même tir.' : result.hits.some(id => level.targets.find(t => t.id === id)?.boss && !destroyed.has(id)) ? 'Gardien touché : il change de position. Trouve sa nouvelle tangente !' : result.hits.length ? `${destroyed.size}/${level.targets.length} cibles détruites. Continue les impacts.` : Math.abs(m) < .035 ? 'Tangente presque horizontale : ajuste ton point.' : 'Faut-il une pente plus grande ou plus petite ?'}`, result.hits.length ? '✦' : '↗');
      updateControls();requestDraw();
    }
  }, state().reducedMotion ? 180 : 650);
}
function beginAttempt() {if (!practice && save.activeAttempt === null && !finished) {save.activeAttempt = level.id;persist();}}
let pointerId: number | null = null;
canvas.addEventListener('pointerdown', event => {
  if (busy || finished || dialog.open) return;
  const nearest = board.nearest(event.clientX, event.clientY);
  if (nearest.distance > 42) {notify('Vise la courbe turquoise. Tu peux glisser pour ajuster ton point.');return;}
  pointerId = event.pointerId;canvas.setPointerCapture(pointerId);aim = nearest.a;timerStarted = true;
  beginAttempt();
  $('#first-tip').hidden = true;requestDraw();
});
canvas.addEventListener('pointermove', event => {
  if (busy || finished || dialog.open) return;
  if (pointerId === event.pointerId) {aim = board.nearest(event.clientX, event.clientY).a;requestDraw();}
});
canvas.addEventListener('pointerup', event => {if (event.pointerId !== pointerId) return;pointerId = null;canvas.releasePointerCapture(event.pointerId);if (aim !== null) shoot(aim);});
canvas.addEventListener('pointercancel', () => {pointerId = null;aim = null;requestDraw();});
canvas.addEventListener('keydown', event => {
  if (busy || finished || dialog.open) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault();aim = Math.max(-5.25, Math.min(5.25, (aim ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? .025 : .1)));canvas.setAttribute('aria-label', board.describe(aim));requestDraw();}
  if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();shoot(aim ?? 0);}
  if (event.key === 'Escape') {aim = null;requestDraw();}
});
function revealHint() {
  if (!practice) {show('Une piste pour réfléchir.', `<p>${WORLDS[level.world].lesson}</p><p>${level.targets.some(t => t.boss) ? 'Le gardien se déplace après chaque impact. Observe sa nouvelle position avant de choisir ton prochain point.' : level.par > 1 ? 'Essaie de répartir les cibles entre plusieurs tangentes. Tu n’es pas obligé de toutes les toucher au même tir.' : 'Compare la direction de la courbe au point de départ et la position de la cible.'}</p><p>Les points de tir exacts sont réservés au laboratoire. Un échec y est sans conséquence pour les vies et ne valide pas la campagne.</p>`);return;}
  assisted = true;
  const next = level.plan.find(s => s.targets.some(id => !destroyed.has(id)) && (s.stage === undefined || s.stage === (damage.get(s.targets[0]) ?? 0))) ?? level.plan[0];
  const a = next.a, m = derivative(level.curve, a);hint = a;
  feedback(`Une trajectoire : <strong>a = ${format(a)}</strong>, <strong>f′(a) ≈ ${format(m)}</strong>. ${level.rule === 'choose' ? `Sens ${next.direction === 'left' ? '← gauche' : 'droite →'}.` : ''} ${level.obstacles.length ? 'Attends que le passage soit libre.' : 'Le cercle indique le point de tir.'}`, '✧');requestDraw();
}
$('#hint').addEventListener('click', revealHint);
function openPractice() {
  if (practice) {practice = false;closeModal();startLevel(save.lastLevel);return;}
  show('Le laboratoire libre.', `<p>Explore les ${WORLDS.length} mondes sans limite de tirs, de vies ni de temps. Les solutions y sont libres et ne valident pas la campagne. Quitter un essai de campagne déjà commencé coûte une vie.</p><div class="practice-worlds">${WORLDS.map((w, i) => `<button data-practice="${i}"><span>${w.icon}</span>${w.name} ↗</button>`).join('')}</div>`);
  for (const b of document.querySelectorAll<HTMLElement>('[data-practice]')) b.addEventListener('click', () => {practice = true;closeModal();startLevel(Number(b.dataset.practice) * 12);});
}
$('#practice').addEventListener('click', openPractice);
function openAchievements() {
  const all = achievements(save);
  show('Tes 50 éclats.', `<p>${all.filter(a => a.done).length}/50 succès débloqués. Les records sont conservés quand tu recommences un monde.</p><div class="achievement-filters" aria-label="Catégories de succès">${['Tous', 'Parcours', 'Précision', 'Combats', 'Maîtrise'].map((c, i) => `<button data-category="${c}" class="${i === 0 ? 'selected' : ''}" aria-pressed="${i === 0}">${c}</button>`).join('')}</div><div id="achievement-list"></div>`);
  const render = (category: string) => {$('#achievement-list').innerHTML = all.filter(a => category === 'Tous' || a.category === category).map(a => `<div class="achievement ${a.done ? 'done' : ''}" data-achievement="${a.id}"><span class="badge" aria-hidden="true">${a.icon}</span><div><strong>${a.name}</strong><p>${a.text}</p><div class="achievement-progress" role="progressbar" aria-label="${a.name}" aria-valuenow="${a.value}" aria-valuemin="0" aria-valuemax="${a.goal}"><i style="width:${a.value / a.goal * 100}%"></i></div></div><span class="count">${a.done ? '✓' : `${a.value}/${a.goal}`}</span></div>`).join('');};
  render('Tous');
  for (const b of document.querySelectorAll<HTMLElement>('[data-category]')) b.addEventListener('click', () => {const category = b.dataset.category!;for (const c of document.querySelectorAll<HTMLElement>('[data-category]')) {c.classList.toggle('selected', c === b);c.setAttribute('aria-pressed', String(c === b));}render(category);});
}
$('#achievements').addEventListener('click', openAchievements);
function openSettings() {
  show('À ta façon.', `<label class="setting-row">Effets sonores<input type="checkbox" id="setting-sound" ${save.sound ? 'checked' : ''}></label><label class="setting-row">Réduire les animations<input type="checkbox" id="setting-motion" ${save.reducedMotion ? 'checked' : ''}></label><p>La progression est stockée uniquement sur cet appareil. Effacer les données du navigateur l’efface aussi. Les paramètres d’accessibilité de ton appareil sont respectés.</p><button class="danger-button" id="reset">Effacer ma progression</button>`);
  $('#setting-sound').addEventListener('change', event => {save.sound = (event.target as HTMLInputElement).checked;updateSound();persist();});
  $('#setting-motion').addEventListener('change', event => {save.reducedMotion = (event.target as HTMLInputElement).checked;document.body.classList.toggle('reduced-motion', save.reducedMotion);persist();requestDraw();});
  $('#reset').addEventListener('click', () => {
    show('Repartir de zéro ?', '<p>Les étoiles et les succès de cet appareil seront effacés.</p><button class="danger-button" id="confirm-reset">Oui, effacer ma progression</button>');
    $('#confirm-reset').addEventListener('click', () => {save = freshSave();practice = false;persist();updateSound();document.body.classList.remove('reduced-motion');closeModal();startLevel(0);});
  });
}
$('#settings').addEventListener('click', openSettings);
function openLesson() {
  show('La tangente, en une minute.', `<p>${WORLDS[level.world].lesson}</p><div class="formula-card">Tangente au point d’abscisse a :<br>y = f′(a)(x − a) + f(a)</div><p><strong>f(a)</strong> donne la hauteur du point de tir. <strong>f′(a)</strong> donne la pente du laser : positive, il monte vers la droite ; négative, il descend vers la droite.</p><p>Le sens ← ou → indique le côté où part le rayon. Une tangente peut atteindre une cible depuis plusieurs points de la courbe : toutes les solutions valables sont acceptées.</p>`);
}
$('#lesson').addEventListener('click', openLesson);
function help() {
  show('Un geste. Une tangente.', `<p><strong>Touche la courbe turquoise</strong> : le laser suit sa tangente. Maintiens et glisse pour affiner, puis relâche pour tirer. Au clavier : <span class="key">← →</span>, <span class="key">Maj</span> pour affiner, <span class="key">Entrée</span> pour tirer.</p><p>↔ Deux rayons · ← Gauche · → Droite. Un obstacle rouge arrête sa branche et coûte <strong>une vie par tir</strong>, même si l’autre branche atteint une cible.</p><p><strong>Trois vies par monde.</strong> Un échec, un abandon ou le rechargement d’un essai commencé coûte une vie. À zéro, reprends le monde avec de nouvelles variations ; les records d’étoiles restent conservés. Termine ses 12 niveaux dans l’ordre pour ouvrir le suivant.</p><p>Les cibles blindées demandent plusieurs impacts. Les gardiens ont une résistance visible et changent de trajectoire après chaque impact. Observe aussi les obstacles mobiles.</p><p><strong>Le centrage</strong> vaut 100 % au centre et 0 % au bord. Le moins bon impact compte.<br>★★★ : centrage ≥ 80 %, dans l’objectif de tirs, sans collision.<br>★★ : centrage ≥ 45 %, au plus un tir de plus que l’objectif.<br>★ : autre réussite. Les solutions exactes du laboratoire ne valident pas la campagne.</p><div class="menu-actions"><button class="secondary-button" id="menu-levels">Choisir un niveau</button><button class="secondary-button" id="menu-practice">${practice ? 'Revenir à la campagne' : 'Laboratoire libre'} ↗</button><button class="secondary-button" id="menu-achievements">Mes succès ✧</button><button class="secondary-button" id="menu-lesson">La minute mathématique</button><button class="secondary-button" id="menu-settings">Préférences</button></div>`);
  $('#menu-levels').addEventListener('click', () => {
    show('Choisis ton défi.', `<div class="level-menu">${Array.from({length: 12}, (_, i) => `<button class="secondary-button" data-jump="${level.world * 12 + i}" ${practice || levelUnlocked(save, level.world * 12 + i) ? '' : 'disabled'}>${String(i + 1).padStart(2, '0')}</button>`).join('')}</div>`);
    for (const b of document.querySelectorAll<HTMLElement>('[data-jump]')) b.addEventListener('click', () => {closeModal();startLevel(Number(b.dataset.jump));});
  });
  $('#menu-practice').addEventListener('click', openPractice);$('#menu-achievements').addEventListener('click', openAchievements);$('#menu-lesson').addEventListener('click', openLesson);$('#menu-settings').addEventListener('click', openSettings);
}
$('#help').addEventListener('click', help);
setupInstallation($<HTMLButtonElement>('#install'), show, notify);
function requestDraw() {if (!raf) raf = requestAnimationFrame(frame);}
function frame(now: number) {
  raf = 0;
  const dt = Math.max(0, Math.min(.1, (now - previous) / 1000));previous = now;
  const active = !document.hidden && !dialog.open && !finished;
  if (active && !busy && hasMotion(level)) targetTime += dt;
  if (active && !busy && timerStarted && level.seconds && !practice) {
    elapsed += dt;updateTimer();if (elapsed >= level.seconds && !busy) finish(false);
  }
  if (now - lastPaint >= 30 || !active || !hasMotion(level)) {board.draw(now);lastPaint = now;}
  const beamAnimating = shot !== null && now - shot.at < 1450;
  if (!document.hidden && ((active && (hasMotion(level) || (timerStarted && level.seconds && !practice))) || beamAnimating || busy)) requestDraw();
}
document.addEventListener('visibilitychange', () => {previous = performance.now();if (!document.hidden) requestDraw();});
let swReady = false;
function connectionState() {$('#connection').innerHTML = `<i></i> ${navigator.onLine ? swReady ? 'PRÊT HORS LIGNE' : 'EN LIGNE' : 'HORS CONNEXION'}`;}
window.addEventListener('online', connectionState);window.addEventListener('offline', connectionState);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const workerURL = new URL('./sw.js', location.href);
  workerURL.searchParams.set('v', document.querySelector<HTMLMetaElement>('meta[name="tangent-client"]')?.content ?? '2');
  void navigator.serviceWorker.register(workerURL.href).then(async registration => {
    // serviceWorker.ready can refer to a previous installation while this release installs.
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker || worker.scriptURL !== workerURL.href) throw new Error('Current offline worker unavailable');
    if (worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (worker.state === 'activated') {worker.removeEventListener('statechange', changed);resolve();}
        else if (worker.state === 'redundant') {worker.removeEventListener('statechange', changed);reject(new Error('Offline installation failed'));}
      };
      worker.addEventListener('statechange', changed);changed();
    });
    swReady = true;connectionState();
  }).catch(() => {notify('Le mode hors connexion n’a pas pu être préparé. Réessaie avec une connexion active.');});
}
document.body.classList.toggle('reduced-motion', save.reducedMotion);updateSound();startLevel(save.lastLevel);connectionState();
if (interrupted) notify('L’essai interrompu a coûté une vie. Ta progression et tes records sont conservés.');
