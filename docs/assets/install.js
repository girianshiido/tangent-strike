export function setupInstallation(button, show, notify) {
    let deferred = null;
    const standalone = () => matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
    const update = () => { button.innerHTML = standalone() ? '✓ Jeu installé' : '<span aria-hidden="true">↓</span> Installer <span class="install-long">le jeu</span>'; };
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event; update(); });
    window.addEventListener('appinstalled', () => { deferred = null; button.textContent = '✓ Jeu installé'; notify('TANGENT STRIKE a été installé. Bon jeu !'); });
    matchMedia('(display-mode: standalone)').addEventListener('change', update);
    button.addEventListener('click', async () => {
        if (standalone()) {
            notify('Le jeu est déjà ouvert comme une application.');
            return;
        }
        if (deferred) {
            const event = deferred;
            deferred = null;
            try {
                await event.prompt();
                const choice = await event.userChoice;
                if (choice.outcome === 'accepted')
                    notify('Installation acceptée.');
            }
            catch {
                showGuide();
            }
            return;
        }
        showGuide();
    });
    function showGuide() {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const android = /Android/.test(navigator.userAgent);
        const instructions = ios ? '<ol><li>Ouvre ce jeu dans <strong>Safari</strong>.</li><li>Ouvre le menu <strong>Partager</strong> (selon la version, dans le menu du navigateur).</li><li>Choisis <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>. Si proposé, active « Ouvrir comme app web ».</li></ol>' : android ? '<ol><li>Ouvre ce jeu dans <strong>Chrome</strong> ou un navigateur compatible.</li><li>Ouvre son menu <strong>⋮</strong>.</li><li>Choisis <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>, puis confirme.</li></ol>' : '<p>Dans un navigateur compatible, utilise l’icône d’installation près de la barre d’adresse ou le menu <strong>Installer TANGENT STRIKE</strong>.</p><p>Sur téléphone ou tablette, ouvre le lien dans ton navigateur, puis utilise <strong>Installer</strong> ou <strong>Sur l’écran d’accueil</strong>.</p>';
        show('Emporte tes tangentes.', `<p>Un raccourci sur ton écran, une fenêtre dédiée et tes niveaux disponibles hors connexion après leur première mise en cache.</p>${instructions}<p>Pas de compte, pas de boutique. Ta progression reste sur cet appareil.</p>`);
    }
    update();
}
