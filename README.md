# TANGENT STRIKE — Le laser des dérivées

**Touche une courbe. Tire sa tangente.** Un jeu de géométrie des fonctions, en français, pour téléphone, tablette et ordinateur.

## Jouer et installer

[Ouvrir le jeu](https://girianshiido.github.io/tangent-strike/)

Le bouton **Installer** utilise la proposition du navigateur lorsqu’elle est disponible. Sur iPhone/iPad, il explique l’ajout à l’écran d’accueil depuis Safari. Le jeu fonctionne également sans installation, dans le navigateur.

Le premier chargement connecté prépare tous les fichiers nécessaires au jeu hors connexion. Les étoiles, succès et préférences restent sur l’appareil, sans compte ni service distant. Effacer les données du navigateur efface la progression.

## Règles

- Touche la courbe turquoise : le laser suit la tangente au point choisi.
- Maintiens et glisse pour ajuster le point, puis relâche pour tirer.
- Les cibles vertes interceptées sont détruites. Un obstacle rouge arrête uniquement la branche qui le rencontre ; les cibles derrière restent protégées.
- **↔** : tir dans les deux sens. **← / →** : sens imposé, ou choisi avant le tir. Droite signifie abscisses croissantes, indépendamment du signe de la pente.
- Au clavier : sélectionne le repère avec Tab, utilise les flèches pour viser, Maj pour affiner, Entrée pour tirer.

60 défis, répartis en cinq mondes de 12 niveaux : **Tir horizontal**, **La bonne pente**, **Double impact**, **Zone interdite**, **Laser Master**. Réussir 8 niveaux d’un monde débloque le suivant. Les niveaux d’un monde ouvert peuvent être joués dans l’ordre de son choix.

Le premier monde demande explicitement une tangente horizontale, avec une petite tolérance de pente pour le toucher. Il comprend aussi des points stationnaires qui ne sont pas des extrema. Dans Double impact, les deux cibles doivent être atteintes au même tir. Les derniers niveaux proposent des cibles mobiles et quelques défis de 25 secondes. Le temps commence au premier geste et se suspend lorsque la page est masquée ou qu’un menu est ouvert.

Les étoiles récompensent à la fois le centrage et l’économie de tirs : **trois étoiles** pour un centrage d’au moins 80 % au premier tir, **deux** pour au moins 45 % en deux tirs maximum, **une** pour une autre réussite. Le centrage vaut 100 % si le rayon passe au centre du disque, 0 % s’il en effleure le bord ; pour plusieurs cibles, le moins bon impact compte. Les messages distinguent « Cible touchée », « Tir précis » et « Plein centre ». Les disques rétrécissent progressivement, de 0,30 à 0,178 unité de rayon.

Un indice limite l’essai à une étoile ; rejouer ne diminue jamais le meilleur score. Le **laboratoire libre**, accessible depuis le menu « ? » sur téléphone, ouvre tous les mondes sans limite de tirs ni chronomètre et propose de nouvelles variations après une réussite, sans modifier la campagne. En paysage sur un petit écran, la sélection des niveaux est également accessible depuis ce menu pour préserver la place du repère.

## Mathématiques

La tangente au point d’abscisse a est calculée par `y = f′(a)(x − a) + f(a)`. Les dérivées sont analytiques ; aucun échantillonnage visuel n’est utilisé pour déterminer la pente.

Les défis sont construits à partir d’un point de tir et de sa tangente. Les cibles mobiles se déplacent le long de cette tangente : une solution reste disponible à tout instant. Les obstacles sont placés pour préserver la solution de construction. Toute autre trajectoire satisfaisant l’objectif du monde est acceptée. Les collisions utilisent les rayons orientés et des intersections exactes avec les disques des cibles et obstacles. Les axes conservent la même échelle.

## Développement

Node.js 22 ou ultérieur, pnpm.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

L’aperçu est disponible à `http://127.0.0.1:5191/`. Le dossier `docs/` contient l’export autonome pour GitHub Pages ; aucun serveur applicatif ni police distante n’est nécessaire.

```sh
pnpm exec playwright install chromium
pnpm qa
```

Les variables facultatives `CHROME_PATH`, `PLAYWRIGHT_MODULE` et `QA_URL` permettent d’utiliser un navigateur déjà installé et de tester une autre URL. Le contrôle navigateur joue les 60 niveaux par les commandes tactiles, vérifie onze tailles d’écran (à partir de 320 × 480), les boutons du menu, la persistance, l’installabilité Chromium et un rechargement hors connexion. Les résultats et captures sont écrits dans `test-results/` (ignoré par Git).

Les tests du moteur vérifient également 1 260 défis et variations à sept instants, les dérivées par différences finies, les sens de tir, l’occlusion, le déblocage et les sauvegardes invalides.

## Publication

Configurer GitHub Pages sur **main / docs** après `pnpm build`. Le service worker reçoit un nom de cache dérivé du contenu et ne supprime que les anciennes versions appartenant à cette application et à sa portée. Les autres jeux hébergés sur le même domaine gardent leurs caches.

L’installation physique sur iOS/Android et le confort tactile réel restent à confirmer sur appareils ; les tests automatisés simulent les tailles et les interactions, sans remplacer cet essai.
