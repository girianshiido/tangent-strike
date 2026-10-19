import { Board } from './board.js';
import { derivative, fire, format, makeLevel, ruleLabel, TOTAL_LEVELS, WORLDS } from './engine.js';
import { achievements, award, freshSave, readSave, worldUnlocked, writeSave } from './storage.js';
import { setupInstallation } from './install.js';
const $ = (selector) => document.querySelector(selector);
let save = readSave();
let level = makeLevel(save.lastLevel);
let practice = false, variant = 0, destroyed = new Set(), used = 0, busy = false, finished = false, assisted = false, hint = false;
let direction = 'both', aim = null, shot = null;
let impactPrecision = new Map();
let elapsed = 0, targetTime = 0, timerStarted = false, token = 0, raf = 0, previous = performance.now(), lastPaint = 0;
let soundContext = null, storageWarning = false, toastTimer = 0;
const dialog = $('#modal');
const canvas = $('#board');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const state = () => ({ level, destroyed, time: targetTime, aim, shot, hint, reducedMotion: save.reducedMotion || motionPreference.matches });
const board = new Board(canvas, state, () => requestDraw());
function persist() {
    if (!writeSave(save) && !storageWarning) {
        storageWarning = true;
        $('#save-caption').textContent = 'Sauvegarde indisponible dans ce navigateur';
        notify('La sauvegarde est indisponible. Garde cette fenêtre ouverte pour conserver ta session.');
    }
}
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { $('#toast').hidden = true; }, 3600); }
function show(title, html) {
    $('#modal-content').innerHTML = `<h2>${title}</h2>${html}`;
    if (!dialog.open)
        dialog.showModal();
}
function closeModal() { dialog.close(); previous = performance.now(); requestDraw(); }
$('#close-modal').addEventListener('click', closeModal);
dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
        closeModal();
} });
dialog.addEventListener('close', () => { previous = performance.now(); requestDraw(); });
function playTone(type) {
    if (!save.sound)
        return;
    try {
        soundContext ??= new AudioContext();
        void soundContext.resume();
        const time = soundContext.currentTime;
        const notes = type === 'win' ? [523.25, 659.25, 783.99] : type === 'hit' ? [659.25, 987.77] : [440];
        notes.forEach((f, i) => {
            const oscillator = soundContext.createOscillator(), gain = soundContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(f, time + i * .08);
            if (type === 'shot')
                oscillator.frequency.exponentialRampToValueAtTime(120, time + .16);
            gain.gain.setValueAtTime(0, time + i * .08);
            gain.gain.linearRampToValueAtTime(.055, time + i * .08 + .012);
            gain.gain.exponentialRampToValueAtTime(.001, time + i * .08 + .2);
            oscillator.connect(gain);
            gain.connect(soundContext.destination);
            oscillator.start(time + i * .08);
            oscillator.stop(time + i * .08 + .22);
        });
    }
    catch { /* Gameplay remains available without Web Audio. */ }
}
function updateSound() { const b = $('#sound'); b.textContent = save.sound ? '♫' : '♪'; b.setAttribute('aria-label', save.sound ? 'Désactiver le son' : 'Activer le son'); b.setAttribute('aria-pressed', String(save.sound)); }
$('#sound').addEventListener('click', () => { save.sound = !save.sound; persist(); updateSound(); });
function updateCampaign() {
    const count = save.stars.filter(Boolean).length;
    $('#campaign-count').textContent = `${String(count).padStart(2, '0')} / 60`;
    $('#campaign-progress').style.width = `${count / TOTAL_LEVELS * 100}%`;
    $('#worlds').innerHTML = WORLDS.map((w, i) => {
        const open = practice || worldUnlocked(save, i), won = save.stars.slice(i * 12, i * 12 + 12).filter(Boolean).length;
        return `<button class="world-card ${i === level.world ? 'active' : ''} ${open ? '' : 'locked'}" data-world="${i}" aria-label="Monde ${i + 1} : ${w.name}${open ? '' : ', verrouillé'}" aria-current="${i === level.world ? 'true' : 'false'}" style="--world:${w.color}"><span class="world-icon" aria-hidden="true">${w.icon}</span><span><small>MONDE 0${i + 1}</small><strong>${w.name}</strong></span><span class="world-status">${open ? `${won}/12` : '⌑'}</span></button>`;
    }).join('');
    $('#levels').innerHTML = Array.from({ length: 12 }, (_, i) => {
        const id = level.world * 12 + i, stars = save.stars[id];
        return `<button class="level-chip ${id === level.id ? 'current' : ''} ${stars ? 'complete' : ''}" data-level="${id}" aria-label="Niveau ${i + 1}${stars ? `, ${stars} étoiles` : ''}" aria-current="${id === level.id ? 'step' : 'false'}">${String(i + 1).padStart(2, '0')}</button>`;
    }).join('');
    $('#achievement-count').textContent = `${achievements(save).filter(a => a.done).length} / 6`;
    $('#practice').classList.toggle('active', practice);
}
function updateControls() {
    $('#shots').innerHTML = practice ? '<span aria-label="Tirs illimités">∞</span>' : Array.from({ length: level.shots }, (_, i) => `<i class="energy-cell ${i < used ? 'spent' : ''}" aria-hidden="true"></i>`).join('');
    $('#shots').setAttribute('aria-label', practice ? 'Tirs illimités' : `${level.shots - used} tirs restants`);
    $('#shots-label').textContent = practice ? 'TIRS LIBRES' : 'ÉNERGIE';
    $('#direction-control').hidden = level.rule !== 'choose';
    for (const b of document.querySelectorAll('[data-direction]')) {
        b.classList.toggle('selected', b.dataset.direction === direction);
        b.setAttribute('aria-pressed', String(b.dataset.direction === direction));
        b.disabled = busy || finished;
    }
    $('#hint').disabled = busy || finished;
    $('#timer').hidden = !level.seconds || practice;
    updateTimer();
    $('#mode-badge').textContent = practice ? 'LABORATOIRE' : 'CAMPAGNE';
}
function updateTimer() {
    const left = Math.max(0, Math.ceil(level.seconds - elapsed));
    if ($('#timer span').textContent !== String(left)) {
        $('#timer span').textContent = String(left);
        $('#timer').classList.toggle('urgent', left <= 5);
    }
}
function feedback(html, symbol = '↗') { $('#feedback').innerHTML = `<span class="feedback-symbol" aria-hidden="true">${symbol}</span><p>${html}</p>`; }
function startLevel(id, nextVariant = 0) {
    token++;
    level = makeLevel(id, nextVariant);
    variant = nextVariant;
    destroyed = new Set();
    impactPrecision = new Map();
    used = 0;
    busy = false;
    finished = false;
    assisted = false;
    hint = false;
    aim = null;
    shot = null;
    elapsed = 0;
    targetTime = 0;
    timerStarted = false;
    previous = performance.now();
    direction = level.rule === 'choose' ? 'right' : level.rule;
    if (!practice) {
        save.lastLevel = id;
        persist();
    }
    document.documentElement.style.setProperty('--world', WORLDS[level.world].color);
    $('#world-caption').textContent = `${practice ? 'LABORATOIRE' : `MONDE 0${level.world + 1}`} / ${WORLDS[level.world].name.toLocaleUpperCase('fr')}`;
    $('#level-title').textContent = level.title;
    $('#level-number').innerHTML = `${String(level.number + 1).padStart(2, '0')}<span> / 12</span>`;
    $('#instruction').textContent = level.instruction;
    $('#mission-detail').textContent = level.rule === 'choose' ? 'Choisis ← ou →, puis touche la courbe.' : 'Touche la courbe. Glisse pour affiner, relâche pour tirer.';
    $('#function').textContent = level.curve.label;
    $('#direction-badge').textContent = ruleLabel(level.rule);
    $('#obstacle-legend').hidden = level.obstacles.length === 0;
    $('#first-tip').hidden = id !== 0 || save.stars[0] > 0 || practice;
    $('#result').hidden = true;
    $('#result').innerHTML = '';
    $('#arena').dataset.level = String(id);
    canvas.setAttribute('aria-label', `${level.curve.label}. ${level.instruction} ${ruleLabel(level.rule)}. Au clavier : flèches pour viser, Entrée pour tirer.`);
    feedback(level.seconds && !practice ? 'Défi de 25 secondes : le compte à rebours commence à ton premier geste.' : practice ? 'Tirs illimités. Les indices révèlent le point de tir, sans modifier tes scores.' : 'Un point sur la courbe. Une tangente. À toi de viser.');
    updateCampaign();
    updateControls();
    requestDraw();
}
$('#worlds').addEventListener('click', event => {
    const b = event.target.closest('[data-world]');
    if (!b)
        return;
    const world = Number(b.dataset.world);
    if (!practice && !worldUnlocked(save, world)) {
        const count = save.stars.slice((world - 1) * 12, world * 12).filter(Boolean).length;
        show('Un monde à découvrir.', `<p>Réussis <strong>8 niveaux</strong> du monde précédent pour ouvrir ${WORLDS[world].name}. Tu en as terminé ${count}.</p><p>Tu peux aussi explorer ce monde dans le <strong>laboratoire libre</strong>.</p><button class="primary-button" id="try-world">Explorer ce monde ↗</button>`);
        $('#try-world').addEventListener('click', () => { practice = true; closeModal(); startLevel(world * 12); });
        return;
    }
    const first = Array.from({ length: 12 }, (_, i) => world * 12 + i).find(id => save.stars[id] === 0) ?? world * 12;
    startLevel(first);
});
$('#levels').addEventListener('click', event => { const b = event.target.closest('[data-level]'); if (b)
    startLevel(Number(b.dataset.level)); });
$('#retry').addEventListener('click', () => startLevel(level.id, variant));
$('#direction-control').addEventListener('click', event => { const b = event.target.closest('[data-direction]'); if (b && !busy && !finished) {
    direction = b.dataset.direction;
    updateControls();
} });
function finish(win, double = false) {
    if (finished)
        return;
    finished = true;
    busy = false;
    let stars = 0;
    const precision = impactPrecision.size ? Math.min(...impactPrecision.values()) : 0;
    const completedBefore = save.stars.every(s => s > 0);
    const before = achievements(save).filter(a => a.done).length;
    if (!practice) {
        if (win)
            stars = award(save, level.id, used, assisted, double, precision);
        else {
            save.streak = 0;
        }
        persist();
    }
    const after = achievements(save).filter(a => a.done).length;
    updateCampaign();
    updateControls();
    const allDone = !practice && !completedBefore && save.stars.every(s => s > 0);
    const grade = precision >= .8 - 1e-9 ? 'Plein centre.' : precision >= .45 - 1e-9 ? 'Tir précis.' : level.targets.length > 1 ? 'Cibles touchées.' : 'Cible touchée.';
    const centering = `Centrage : ${Math.round(precision * 100)} % · ${used} tir${used > 1 ? 's' : ''}.`;
    $('#result').innerHTML = `<div class="result-mark" aria-hidden="true">${win ? '✦' : '↻'}</div>${win && !practice ? `<div class="stars" aria-label="${stars} étoiles">${Array.from({ length: 3 }, (_, i) => `<span class="${i < stars ? '' : 'empty'}">★</span>`).join('')}</div>` : ''}<h3>${allDone ? 'Dérivée suprême !' : win ? grade : 'Ajuste ta trajectoire.'}</h3><p>${allDone ? 'Les 60 défis sont réussis. Reviens chercher les trois étoiles ou explore le laboratoire.' : win ? `${centering} ${assisted ? 'Rejoue sans indice pour gagner davantage d’étoiles.' : practice ? 'Essaie de rapprocher le rayon du centre de chaque disque.' : after > before ? 'Un nouveau succès est débloqué !' : precision < .8 ? 'Vise le centre du disque pour améliorer tes étoiles.' : 'Un rayon au plus près du centre de chaque cible.'}` : elapsed >= level.seconds && level.seconds > 0 ? 'Le temps est écoulé. Le laboratoire permet de réfléchir sans chronomètre.' : 'Observe la pente du dernier laser, puis déplace ton point de tir.'}</p><div class="result-buttons"><button class="primary-button" id="result-next">${win ? practice ? 'Nouvelle variation ↗' : level.id === TOTAL_LEVELS - 1 ? 'Retour au parcours ↗' : 'Niveau suivant →' : 'Réessayer ↻'}</button><button class="secondary-button" id="result-replay">${win ? 'Rejouer' : 'Voir une solution'}</button></div>${win && !practice ? '<p class="mini">★ Touché · ★★ Précis en ≤ 2 tirs · ★★★ Plein centre au 1er tir · Indice : ★</p>' : ''}`;
    $('#result').hidden = false;
    $('#result-next').addEventListener('click', () => {
        if (!win)
            startLevel(level.id, variant);
        else if (practice)
            startLevel(level.id, variant + 1);
        else
            startLevel(level.id === TOTAL_LEVELS - 1 ? (save.stars.findIndex(s => !s) >= 0 ? save.stars.findIndex(s => !s) : 0) : level.id + 1);
    });
    $('#result-replay').addEventListener('click', () => { startLevel(level.id, variant); if (!win)
        revealHint(); });
    if (win)
        playTone('win');
    requestDraw();
}
function shoot(a) {
    if (busy || finished || dialog.open || (!practice && used >= level.shots))
        return;
    $('#first-tip').hidden = true;
    busy = true;
    timerStarted = true;
    aim = null;
    used++;
    if (!practice) {
        save.attempts++;
        persist();
    }
    const result = fire(level, a, direction, targetTime, destroyed), thisToken = token;
    shot = { result, at: performance.now() };
    playTone('shot');
    updateControls();
    requestDraw();
    const m = result.slope, b = result.origin.y - m * a;
    const equation = `y ≈ ${format(m)}x ${b < 0 ? '−' : '+'} ${format(Math.abs(b))}`;
    const explanation = `<strong>a ≈ ${format(a)} · f′(a) ≈ ${format(m)}</strong> &nbsp;|&nbsp; ${equation}`;
    feedback(explanation, 'ϟ');
    window.setTimeout(() => {
        if (thisToken !== token)
            return;
        if (level.world === 2 && result.hits.length !== level.targets.length) {
            destroyed.clear();
            impactPrecision.clear();
        }
        else {
            result.hits.forEach(id => destroyed.add(id));
            result.impacts.forEach(i => impactPrecision.set(i.id, i.precision));
        }
        busy = false;
        if (result.hits.length)
            playTone('hit');
        const blocked = result.beams.some(b => b.blocked);
        if (destroyed.size === level.targets.length)
            finish(true, result.hits.length >= 2);
        else if (!practice && used >= level.shots)
            finish(false);
        else {
            feedback(`${explanation}<br>${level.world === 0 && Math.abs(m) > .065 ? 'Dans ce monde, cherche une pente nulle : f′(a) = 0.' : level.world === 2 ? 'Les deux cibles doivent être touchées par le même tir.' : result.hits.length ? 'Une cible détruite. Vise la suivante.' : blocked ? 'Un obstacle a arrêté le rayon. Change de point ou de sens.' : Math.abs(m) < .035 ? 'Tangente presque horizontale : ajuste ton point.' : 'Faut-il une pente plus grande ou plus petite ?'}`, result.hits.length ? '✦' : '↗');
            updateControls();
            requestDraw();
        }
    }, state().reducedMotion ? 180 : 650);
}
let pointerId = null;
canvas.addEventListener('pointerdown', event => {
    if (busy || finished || dialog.open)
        return;
    const nearest = board.nearest(event.clientX, event.clientY);
    if (nearest.distance > 42) {
        notify('Vise la courbe turquoise. Tu peux glisser pour ajuster ton point.');
        return;
    }
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    aim = nearest.a;
    timerStarted = true;
    $('#first-tip').hidden = true;
    requestDraw();
});
canvas.addEventListener('pointermove', event => {
    if (busy || finished || dialog.open)
        return;
    if (pointerId === event.pointerId) {
        aim = board.nearest(event.clientX, event.clientY).a;
        requestDraw();
    }
});
canvas.addEventListener('pointerup', event => { if (event.pointerId !== pointerId)
    return; pointerId = null; canvas.releasePointerCapture(event.pointerId); if (aim !== null)
    shoot(aim); });
canvas.addEventListener('pointercancel', () => { pointerId = null; aim = null; requestDraw(); });
canvas.addEventListener('keydown', event => {
    if (busy || finished || dialog.open)
        return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        aim = Math.max(-5.25, Math.min(5.25, (aim ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? .025 : .1)));
        canvas.setAttribute('aria-label', board.describe(aim));
        requestDraw();
    }
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        shoot(aim ?? 0);
    }
    if (event.key === 'Escape') {
        aim = null;
        requestDraw();
    }
});
function revealHint() {
    assisted = true;
    hint = true;
    const a = level.solution, m = derivative(level.curve, a);
    feedback(`Une solution : <strong>a = ${format(a)}</strong>, donc <strong>f′(a) ≈ ${format(m)}</strong>. ${level.rule === 'choose' ? `Choisis le sens ${level.solutionDirection === 'left' ? '← gauche' : 'droite →'}.` : 'Le cercle pointillé indique le point de tir.'}`, '✧');
    requestDraw();
}
$('#hint').addEventListener('click', () => {
    if (practice) {
        revealHint();
        return;
    }
    show('Un coup de lumière ?', '<p>L’indice montre une solution sur la courbe et sa pente. Ce niveau rapportera alors <strong>une étoile au maximum</strong> pour cet essai.</p><button class="primary-button" id="confirm-hint">Afficher l’indice ✧</button>');
    $('#confirm-hint').addEventListener('click', () => { closeModal(); revealHint(); });
});
function openPractice() {
    if (practice) {
        practice = false;
        closeModal();
        startLevel(save.lastLevel);
        return;
    }
    show('Le laboratoire libre.', `<p>Explore les cinq mondes, sans limite de tirs ni chronomètre. Les indices sont libres et les scores de campagne restent inchangés.</p><div class="practice-worlds">${WORLDS.map((w, i) => `<button data-practice="${i}"><span>${w.icon}</span>${w.name} ↗</button>`).join('')}</div>`);
    for (const b of document.querySelectorAll('[data-practice]'))
        b.addEventListener('click', () => { practice = true; closeModal(); startLevel(Number(b.dataset.practice) * 12); });
}
$('#practice').addEventListener('click', openPractice);
function openAchievements() { show('Tes éclats de précision.', achievements(save).map(a => `<div class="achievement ${a.done ? 'done' : ''}"><span class="badge" aria-hidden="true">${a.icon}</span><div><strong>${a.name}</strong><p>${a.text}</p></div><span class="count">${a.done ? '✓' : `${a.value}/${a.goal}`}</span></div>`).join('')); }
$('#achievements').addEventListener('click', openAchievements);
function openSettings() {
    show('À ta façon.', `<label class="setting-row">Effets sonores<input type="checkbox" id="setting-sound" ${save.sound ? 'checked' : ''}></label><label class="setting-row">Réduire les animations<input type="checkbox" id="setting-motion" ${save.reducedMotion ? 'checked' : ''}></label><p>La progression est stockée uniquement sur cet appareil. Effacer les données du navigateur l’efface aussi. Les paramètres d’accessibilité de ton appareil sont respectés.</p><button class="danger-button" id="reset">Effacer ma progression</button>`);
    $('#setting-sound').addEventListener('change', event => { save.sound = event.target.checked; updateSound(); persist(); });
    $('#setting-motion').addEventListener('change', event => { save.reducedMotion = event.target.checked; document.body.classList.toggle('reduced-motion', save.reducedMotion); persist(); requestDraw(); });
    $('#reset').addEventListener('click', () => {
        show('Repartir de zéro ?', '<p>Les étoiles et les succès de cet appareil seront effacés.</p><button class="danger-button" id="confirm-reset">Oui, effacer ma progression</button>');
        $('#confirm-reset').addEventListener('click', () => { save = freshSave(); practice = false; persist(); updateSound(); document.body.classList.remove('reduced-motion'); closeModal(); startLevel(0); });
    });
}
$('#settings').addEventListener('click', openSettings);
function openLesson() {
    show('La tangente, en une minute.', `<p>${WORLDS[level.world].lesson}</p><div class="formula-card">Tangente au point d’abscisse a :<br>y = f′(a)(x − a) + f(a)</div><p><strong>f(a)</strong> donne la hauteur du point de tir. <strong>f′(a)</strong> donne la pente du laser : positive, il monte vers la droite ; négative, il descend vers la droite.</p><p>Le sens ← ou → indique le côté où part le rayon. Une tangente peut atteindre une cible depuis plusieurs points de la courbe : toutes les solutions valables sont acceptées.</p>`);
}
$('#lesson').addEventListener('click', openLesson);
function help() {
    show('Un geste. Une tangente.', `<p><strong>Touche la courbe turquoise</strong> : le laser suit sa tangente. Détruis les cibles vertes avant d’épuiser tes tirs.</p><p>Tu peux maintenir et glisser pour affiner le point, puis relâcher pour tirer. Sur clavier : <span class="key">← →</span> pour viser, <span class="key">Maj</span> pour affiner, <span class="key">Entrée</span> pour tirer.</p><p>↔ Deux rayons · ← Gauche · → Droite<br>Un obstacle rouge arrête le rayon qui le rencontre.</p><p><strong>Le centrage</strong> vaut 100 % au centre d’un disque et 0 % sur son bord. Pour plusieurs cibles, le moins bon impact compte.<br>★★★ : centrage ≥ 80 %, au premier tir.<br>★★ : centrage ≥ 45 %, en deux tirs maximum.<br>★ : niveau réussi, ou indice utilisé.<br>Les disques rétrécissent progressivement au fil des niveaux.</p><div class="menu-actions"><button class="secondary-button" id="menu-levels">Choisir un niveau</button><button class="secondary-button" id="menu-practice">${practice ? 'Revenir à la campagne' : 'Laboratoire libre'} ↗</button><button class="secondary-button" id="menu-achievements">Mes succès ✧</button><button class="secondary-button" id="menu-lesson">La minute mathématique</button><button class="secondary-button" id="menu-settings">Préférences</button></div>`);
    $('#menu-levels').addEventListener('click', () => {
        show('Choisis ton défi.', `<div class="level-menu">${Array.from({ length: 12 }, (_, i) => `<button class="secondary-button" data-jump="${level.world * 12 + i}">${String(i + 1).padStart(2, '0')}</button>`).join('')}</div>`);
        for (const b of document.querySelectorAll('[data-jump]'))
            b.addEventListener('click', () => { closeModal(); startLevel(Number(b.dataset.jump)); });
    });
    $('#menu-practice').addEventListener('click', openPractice);
    $('#menu-achievements').addEventListener('click', openAchievements);
    $('#menu-lesson').addEventListener('click', openLesson);
    $('#menu-settings').addEventListener('click', openSettings);
}
$('#help').addEventListener('click', help);
setupInstallation($('#install'), show, notify);
function requestDraw() { if (!raf)
    raf = requestAnimationFrame(frame); }
function frame(now) {
    raf = 0;
    const dt = Math.max(0, Math.min(.1, (now - previous) / 1000));
    previous = now;
    const active = !document.hidden && !dialog.open && !finished;
    if (active && !busy && level.targets.some(t => t.motion))
        targetTime += dt;
    if (active && timerStarted && level.seconds && !practice) {
        elapsed += dt;
        updateTimer();
        if (elapsed >= level.seconds && !busy)
            finish(false);
    }
    if (now - lastPaint >= 30 || !active || !level.targets.some(t => t.motion)) {
        board.draw(now);
        lastPaint = now;
    }
    const beamAnimating = shot !== null && now - shot.at < 1450;
    if (!document.hidden && ((active && (level.targets.some(t => t.motion) || (timerStarted && level.seconds && !practice))) || beamAnimating || busy))
        requestDraw();
}
document.addEventListener('visibilitychange', () => { previous = performance.now(); if (!document.hidden)
    requestDraw(); });
let swReady = false;
function connectionState() { $('#connection').innerHTML = `<i></i> ${navigator.onLine ? swReady ? 'PRÊT HORS LIGNE' : 'EN LIGNE' : 'HORS CONNEXION'}`; }
window.addEventListener('online', connectionState);
window.addEventListener('offline', connectionState);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    void navigator.serviceWorker.register('./sw.js').then(async () => { await navigator.serviceWorker.ready; swReady = true; connectionState(); }).catch(() => { notify('Le mode hors connexion n’a pas pu être préparé. Réessaie avec une connexion active.'); });
}
document.body.classList.toggle('reduced-motion', save.reducedMotion);
updateSound();
startLevel(save.lastLevel);
connectionState();
