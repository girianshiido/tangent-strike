# TANGENT STRIKE — Le laser des dérivées

**Touche une courbe. Tire sa tangente.** Un jeu de géométrie des fonctions en français, pour téléphone, tablette et ordinateur.

[Jouer et installer](https://girianshiido.github.io/tangent-strike/)

## Campagne : 96 défis, huit mondes

1. **Tir horizontal** : reconnaître une pente nulle, y compris sans extremum.
2. **La bonne pente** : anticiper la tangente et le sens du laser.
3. **Double impact** : atteindre deux cibles avec une même tangente.
4. **Zone interdite** : éviter les obstacles et protéger ses vies.
5. **Laser Master** : deux tangentes distinctes, ou une tangente commune à un instant précis.
6. **Trajectoires croisées** : trois cibles réparties sur deux ou trois tangentes, puis des cibles blindées.
7. **Champ instable** : obstacles mobiles, croisements, blindages et gardien.
8. **Orbites** : cercles, ellipses, huit, spirales et courbes ondulées, avec tangentes verticales et gardien orbital.

Les mondes 5 à 7 alternent paraboles convexes et concaves, cubiques, quartiques, sinus et cosinus. Les rendez-vous mobiles demandent des pentes variées.

Chaque monde compte 12 niveaux. La campagne les débloque dans l’ordre ; terminer les 12 ouvre le monde suivant. Le laboratoire donne un accès libre à tous les défis sans valider la campagne.

## Vies et résistance

La campagne accorde **trois vies par monde**. Un obstacle touché coûte une vie par tir, même si l’autre branche atteint une cible. Plusieurs obstacles touchés par le même tir ne cumulent pas les dégâts. Épuiser les tirs ou le temps coûte une vie ; une collision sur le dernier tir n’ajoute pas un deuxième malus pour cet échec.

Abandonner, recommencer ou recharger un essai déjà commencé coûte une vie. À zéro, le monde reprend au premier niveau avec trois vies et une nouvelle variation des défis. Les records d’étoiles, les succès acquis et l’accès aux mondes déjà ouverts restent conservés.

Les **cibles blindées** demandent deux impacts. Les derniers niveaux des mondes 5, 6 et 7 mettent en scène un **gardien** de 3, 4 ou 5 points de résistance. Il se déplace et change de position et de tangente après chaque impact ; les deux derniers gardiens ont des cibles d’escorte. Le gardien orbital possède quatre points de résistance. Les anneaux et les nombres indiquent la résistance restante.

Le nombre de tirs tient compte des tangentes nécessaires et des résistances. L’« objectif » affiché est le budget de référence pour les étoiles. Les derniers défis ont parfois un chronomètre : il commence au premier geste et se suspend dans les menus ou lorsque la page est masquée.

## Commandes et récompenses

- Touche la courbe turquoise pour choisir le départ du laser.
- Maintiens et glisse pour ajuster, puis relâche pour tirer.
- **↔** tire dans les deux sens. **← / →** impose ou permet de choisir le sens avant le tir.
- Dans **Orbites**, les petites flèches indiquent le sens croissant du paramètre : **→** suit le parcours, **←** le remonte, quelle que soit la direction à l’écran.
- Au clavier : sélectionne le repère avec Tab, flèches pour viser, Maj pour affiner, Entrée pour tirer.
- Un disque doit être intercepté pour subir un impact. Le halo extérieur est décoratif.

Le centrage vaut 100 % au centre du disque, 0 % au bord. Le moins bon impact du niveau compte, y compris les impacts successifs sur un blindage ou un gardien.

- **★★★** : centrage d’au moins 80 %, dans l’objectif de tirs et sans collision.
- **★★** : au moins 45 %, avec au maximum un tir de plus que l’objectif.
- **★** : autre réussite.

Une nouvelle tentative ne diminue pas un record d’étoiles. Les indices de campagne expliquent une méthode sans donner le point exact. Les solutions chiffrées et les marqueurs de tir sont réservés au laboratoire : ils n’accordent ni étoiles, ni progression, ni succès de combat.

**51 succès** sont répartis en quatre catégories filtrables : Parcours, Précision, Combats et Maîtrise. Leurs jauges suivent les niveaux différents, les étoiles, les impacts multiples, les blindages, les gardiens et les séries sans échec. Les trois gardiens doivent réellement être vaincus pour leurs succès, même avec une ancienne sauvegarde complète.

## Installation, sauvegarde et audio

Le bouton **Installer** utilise la proposition du navigateur lorsqu’elle est disponible. Sur iPhone/iPad, il explique l’ajout à l’écran d’accueil depuis Safari. Le jeu fonctionne aussi directement dans le navigateur.

Le premier chargement connecté prépare tous les fichiers pour jouer hors connexion. La progression reste sur l’appareil, sans compte. Les anciennes sauvegardes (60 ou 84 niveaux) sont migrées : les étoiles et les mondes déjà ouverts sont conservés. Effacer les données du navigateur efface la sauvegarde.

Les huit bruitages mélodiques originaux sont fournis en **OGG**, avec repli **MP3**. Web Audio les décode une fois, après un geste du joueur, puis les joue sans téléchargement supplémentaire. Les deux formats sont disponibles hors connexion. Le bouton de son et les préférences permettent de les désactiver ; couper le son arrête aussi les notes en cours.

L’interface de jeu tient sans défilement sur les formats de test, à partir de 320 × 480 pixels. Sur petit écran en paysage, les niveaux se choisissent dans le menu « ? » pour préserver la place du repère.

## Mathématiques et génération

La tangente au point d’abscisse a est calculée par `y = f′(a)(x − a) + f(a)`. Les dérivées sont analytiques. Les axes gardent la même échelle ; le cadrage inclut les déplacements complets des cibles, les phases des gardiens et les obstacles.

Pour les courbes paramétrées, la tangente suit le vecteur analytique `(x′(t), y′(t))`. Le calcul accepte les tangentes verticales sans diviser par `x′(t)`. La visée se fait sur l’ensemble de la courbe, avec continuité de branche aux croisements.

Les cibles sont construites sur une ou plusieurs tangentes. Chacune peut se déplacer le long de sa propre tangente, tout en restant atteignable. Les rendez-vous mobiles croisent également une tangente commune à certains instants, permettant un tir groupé. Les obstacles mobiles ouvrent et ferment des passages ; les tests cherchent des fenêtres sûres dans leur cycle.

Les collisions utilisent les intersections de rayons orientés avec des disques, à l’instant du tir. Un obstacle arrête sa seule branche. Un même appui ne retire qu’un point de résistance par cible, même en double rayon. Toute autre trajectoire satisfaisant l’objectif est acceptée. Le premier monde demande une tangente horizontale pour obtenir deux ou trois étoiles ; un impact au bord du disque rapporte toujours au moins une étoile.

## Développer et vérifier

Node.js 22 ou ultérieur, pnpm.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

L’aperçu est disponible à `http://127.0.0.1:5191/`. `docs/` contient l’export autonome pour GitHub Pages ; le jeu n’a besoin d’aucun serveur applicatif ni police distante.

```sh
pnpm exec playwright install chromium
pnpm qa
pnpm qa:orbits
pnpm qa:render
pnpm qa:audio
```

`CHROME_PATH`, `PLAYWRIGHT_MODULE` et `QA_URL` permettent d’utiliser un navigateur installé et une autre URL. Les résultats et captures sont enregistrés dans `test-results/`, ignoré par Git.

Les tests du moteur contrôlent 2 016 défis et variations à sept instants de départ, les fenêtres des obstacles mobiles, les répartitions de cibles, les résistances, les phases des gardiens, les vies, la migration et les 51 succès. Les essais navigateur jouent les 96 défis par les commandes tactiles et vérifient onze formats, la flèche, les malus, les reprises, le laboratoire et le rechargement hors connexion. Les contrôles d’Orbites couvrent aussi les anciennes sauvegardes, les tirs verticaux, les sens de parcours et 36 cadrages. Les contrôles audio vérifient les deux formats, le silence et le fonctionnement hors connexion.

## Publier

Après `pnpm build`, GitHub Pages sert **main / docs**. Les modules utilisent un chemin versionné commun pour éviter de mélanger deux versions dans une application déjà installée. Le service worker utilise un cache dérivé du contenu et ne supprime que les anciennes versions de cette application et de sa portée. `node scripts/verify-public.mjs` compare les fichiers publics à l’export local.

Les tests simulent les formats et les gestes. Le confort tactile et l’installation physique sur iOS/Android restent à confirmer sur appareils.
