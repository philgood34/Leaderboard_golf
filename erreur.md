# Erreurs, limites et points de vigilance

Document recensant les problemes rencontres pendant le developpement, les limites assumees de la v1 et les pieges potentiels en production.

## Donnees parcours (scraping ffgolf)

### 1. Donnees femmes manquantes sur ffgolf

Sur la calculette officielle FFGolf, les champs `Slope (Dames)` et `SSS (Dames)` retournent `0` pour la plupart des grands parcours 18 trous (Massane, Cap d'Agde Champion, Fontcaude Int, Beziers, Flamants Roses). Sur les 9 trous et certains parcours plus accessibles (Fabregues, Lamalou, Pic Saint-Loup, Goelands, Ecureuil, Fontcaude Exec), les donnees femmes sont presentes mais NON exploitees dans la v1 de l'app.

**Impact :** dans la v1, les joueuses utilisent les memes valeurs slope/SSS que les hommes. Sur un 9 trous compact (par 3), le biais est faible ; sur un 18 trous championnat, il peut faire varier le HCP de jeu de 1 a 3 coups.

**Contournement :** ajouter `slope_f`, `sss_f` dans le schema `courses` et basculer en fonction du sexe du joueur dans `playingHandicap()`.

### 1bis. Par "double" pour les 9 trous

ffgolf publie pour certains 9 trous un `Par Total: 54` alors que la somme des 9 pars individuels est 27. C'est le par de l'aller-retour (jouer le 9 trous deux fois). Le code utilise systematiquement la somme des pars individuels via `holes.reduce((s,h)=>s+h.par,0)` pour eviter ce piege.

### 2. Calculette ffgolf rendue en JavaScript

L'URL `https://pages.ffgolf.org/tools/calculette?glfcod=...&tercod=...&k=...` charge ses tableaux par-tee dynamiquement (XHR cote client). Un simple `fetch + cheerio` ne recupere QUE le repere par defaut (souvent les noirs).

**Impact :** un scraper Node naif ne recupere pas tous les reperes (jaunes, blancs, bleus, rouges...). Pour les 5 parcours actuels, seul le repere principal a ete extrait.

**Contournement :** utiliser Puppeteer/Playwright ou inspecter l'API XHR sous-jacente. Ou bien intercepter le token `k=...` qui semble etre un signed token avec TTL.

### 3. Donnees gravees en dur dans seed-courses.js

Le scraping a ete fait manuellement (via WebFetch) au moment du dev, puis les valeurs ont ete copiees dans `seed-courses.js`. Ce n'est PAS un scraper automatique.

**Impact :** si ffgolf met a jour les valeurs (re-mesure officielle, changement de pars), il faut re-faire le scraping a la main.

**Contournement :** ecrire un vrai script `scrape-ffgolf.js` (avec Puppeteer) qui regenere `seed-courses.js`.

## Calcul handicap & scoring

### 4. Indice 36 vs HCP de jeu eleve

Pour une joueuse a `index 36` sur Massane (slope 135, sss 74.7) : `HCP de jeu = round(36 * 135/113 + 2.7) = 46`. Soit 2 coups par trou + 1 coup sur SI 1-10. Sur certaines formules (chicago), le quota devient negatif (`39 - 46 = -7`), ce qui est correct mathematiquement mais peut surprendre.

**Impact :** le score Chicago d'un debutant peut etre tres haut (puisque chaque point compte au-dessus de 0). Pas de bug, c'est le fonctionnement attendu.

### 5. Matchplay multi-joueurs : interpretation skins

Le matchplay en sa forme officielle est en duel (2 joueurs). Pour 3+ joueurs, il n'existe pas de regle FFGolf canonique. Choix v1 : **skins** (le score le plus bas STRICTEMENT remporte le trou ; egalite = personne ne gagne).

**Impact :** si on veut du "vrai" matchplay multi (ex : deux equipes, four-ball, etc.), il faut reecrire `rankMatchplay` dans [scoring.js](scoring.js).

### 6. Chicago : gross vs net

Le user a confirme la grille `bogey=1, par=2, birdie=4, eagle=8` mais sans preciser si c'est sur le **brut** ou le **net**. Choix v1 : **points calcules sur le score brut**, le quota (39 - HCP de jeu) faisant office de mecanisme de handicap. Variante traditionnelle. Si une autre variante est attendue (points sur le net), modifier la fonction `chicagoPoints` dans [scoring.js](scoring.js).

## Architecture & deploiement

### 7. Une seule partie active a la fois

Le `getActiveGame()` retourne la derniere partie en `setup` ou `active`. Creer une nouvelle partie cloture l'ancienne (`UPDATE games SET status='closed'`).

**Impact :** impossible de gerer plusieurs parties en parallele. Volontaire pour le scope de la v1.

**Contournement :** ajouter un `game_code` (4 caracteres) que les joueurs entrent pour rejoindre, et router via ce code.

### 8. Pas d'authentification (mais code 4 chiffres v2)

L'identite "joueur" est juste un `localStorage.me_player_id_<gameId>` cote client. N'importe qui peut "etre" un autre joueur en re-selectionnant son nom. Comme tout le monde peut deja saisir le score de tout le monde (option B), ce n'est pas un probleme pour le scope.

**Mise a jour v2** : un code 4 chiffres est genere a la creation et requis pour rejoindre. Stockage en clair en DB (gatekeeping casual, pas un secret crypto). Brute force possible sur 10000 combinaisons : pour un usage hors-ligne sur le terrain c'est OK, pour un deploiement public il faudrait un rate-limit ou un code plus long.

### 14. Slope double pour 9->18 (approximation)

Quand l'option "Jouer en 18 trous" est cochee sur un 9 trous, le serveur double slope/SSS/par. Pour le par et le SSS c'est mathematiquement exact (jouer 2 fois la meme boucle). Pour le slope, l'approximation est plus grossiere : ffgolf publie un slope qui semble deja partiellement normalise pour 9 trous (Fabregues = 37, tres bas). Doubler donne 74, ce qui rapproche d'un equivalent 18 trous typique mais sans garantie d'etre la valeur officielle FFGolf si le club faisait calibrer le parcours en 18 trous.

### 15. Tunnel ngrok partage le port mais pas le code

`server.js` ouvre automatiquement un tunnel ngrok via `@ngrok/ngrok` si `NGROK_API` est dans `.env`. L'URL publique est affichee dans la console mais N'EST PAS persistee : a chaque redemarrage, nouvelle URL. Pour une URL stable, il faut un domaine reserve sur le compte ngrok payant + passer `domain: "..."` dans `ngrok.connect()`.

### 9. ngrok HTTPS et Socket.IO

Avec ngrok en mode HTTPS (par defaut), Socket.IO doit fonctionner sans config particuliere car le client utilise `io()` (auto-detection). Si on passe en mode ngrok TCP brut (`ngrok tcp 3000`), il faudra ajuster.

### 10. Encodage Windows / SQLite WAL

`db.pragma('journal_mode = WAL')` cree des fichiers `golf.db-shm` et `golf.db-wal` a cote de `golf.db`. Ils sont normaux. Si on veut sauvegarder/copier la DB, faire un `VACUUM` ou un checkpoint avant.

### 11. Permissions navigateur sur iOS pour Socket.IO

Sur iOS Safari avec ngrok, parfois la connexion WebSocket prend ~2s a s'etablir (handshake). Le leaderboard se rafraichit alors apres un court delai au premier chargement. Pas de bug, juste un comportement reseau.

## Code / dependances

### 12. better-sqlite3 et node-gyp sur Windows

`better-sqlite3` a des binaires precompiles pour Windows x64 (Node 16+). Pour Node 14 ou ARM Windows, il faut compiler avec `node-gyp` (necessite Visual Studio Build Tools). Aucun probleme rencontre sur la machine de dev (Windows 11, Node recent).

### 13. Caracteres accentues dans les fichiers source

Les fichiers JS/HTML sont en UTF-8 mais les commentaires evitent volontairement les accents (`recoit` au lieu de `reçoit`, `cloture` au lieu de `clôture`) pour eviter tout probleme d'encodage cross-platform si le projet est ouvert dans un editeur configure en latin-1.

## Limites assumees de la v1

- 18 trous fixe (pas de support 9 trous tour de force).
- Pas d'historique : une partie cloturee reste en DB mais n'est pas affichee dans une liste "parties precedentes".
- Pas d'export (PDF, CSV) du scorecard final.
- Pas de gestion de "score max" (par + 5 pour stableford), score saisi tel quel.
- Pas de bouton "annuler la derniere saisie" (mais le numpad permet d'effacer un score via "Eff.").
