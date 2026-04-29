# Leaderboard Golf

Application web mobile-first pour suivre en direct les scores d'une partie de golf, avec leaderboard live multi-joueurs et plusieurs formules de jeu.

## Fonctionnalites

- 5 parcours de l'Herault pre-charges (donnees ffgolf.org : par, slope, SSS, stroke index par trou)
- 5 formules : Stroke Play Brut/Net, Matchplay Brut/Net (skins), Chicago
- Calcul automatique du HCP de jeu et des coups recus par trou (systeme standard)
- Saisie multi-appareils : chaque joueur saisit sur son telephone
- N'importe qui peut saisir le score de n'importe quel joueur (option B)
- Identification simple : chaque joueur "prend" son nom dans la liste a l'arrivee
- Trou par trou independant (pas de synchronisation entre joueurs)
- Leaderboard temps reel via Socket.IO
- SQLite local (zero config)

## Stack

- Node.js + Express + Socket.IO
- SQLite (better-sqlite3)
- Frontend HTML/CSS/JS vanilla (aucun build step)

## Installation

```bash
npm install
```

Au premier lancement, la table `courses` est seedee automatiquement avec les 5 parcours de l'Herault.

## Configuration ngrok (optionnelle)

Cree un fichier `.env` a la racine :
```
NGROK_API=ton_token_ngrok
```
Le serveur ouvrira automatiquement un tunnel ngrok au demarrage et affichera l'URL publique.
Sans `.env` ou `NGROK_API`, le serveur tourne en local seul.

## Lancer le serveur

```bash
npm start
```

Sortie attendue :
```
Leaderboard golf en ecoute sur http://localhost:3000
  Ngrok actif : https://xxxxx.ngrok-free.dev
```

Partage l'URL ngrok et le code 4 chiffres genere a la creation de la partie.

## Securite

A la creation d'une partie, un **code 4 chiffres** est genere automatiquement et affiche a l'organisateur. Tous les joueurs doivent l'entrer pour rejoindre. Stocke en localStorage cote client pour eviter le re-prompt.

## Format 9 trous joue en 18

Pour les 4 parcours 9-trous (Fabregues, Lamalou, L'Ecureuil, Fontcaude Exec), une option "Jouer en 18 trous (deux tours)" double le parcours : trous 1-9 puis 10-18 avec memes par/SI. Slope, SSS et par sont doubles pour le calcul du HCP de jeu.

## Historique et telechargement

A la fin d'une partie, modal avec classement final + boutons :
- **CSV** : tableur ouvrable dans Excel (BOM UTF-8 inclus)
- **Carte imprimable** : page dediee avec CSS print, bouton "Imprimer / Enregistrer en PDF"

Page `/history.html` liste les 50 dernieres parties closes. Chaque telechargement re-demande le code (ou prend depuis localStorage).

## Parcours pre-charges

11 parcours scrappes depuis [ffgolf.org](https://www.ffgolf.org/parcours-detours/guide-des-golfs/occitanie/herault) (calculette officielle de la FFGolf) :

### 18 trous (7)
| Parcours | Ville | Par | Slope | SSS |
|---|---|---|---|---|
| Massane (Montpellier) | Baillargues | 72 | 135 | 74.7 |
| La Grande Motte - Flamants Roses | La Grande-Motte | 72 | 133 | 72.7 |
| La Grande Motte - Les Goelands | La Grande-Motte | 58 | 90 | 54.2 |
| Cap d'Agde - Champion | Cap d'Agde | 72 | 139 | 73.3 |
| Fontcaude - International | Juvignac | 72 | 144 | 73.4 |
| Beziers Saint-Thomas | Beziers | 72 | 140 | 73.1 |
| Pic Saint-Loup - Le Puech | Saint-Mathieu-de-Treviers | 69 | 150 | 70.6 |

### 9 trous (4)
| Parcours | Ville | Par | Slope | SSS |
|---|---|---|---|---|
| Fabregues Compact | Fabregues | 27 | 37 | 27.5 |
| Lamalou-les-Bains | Lamalou-les-Bains | 35 | 66 | 33.8 |
| Massane - L'Ecureuil | Baillargues | 27 | 40 | 24 |
| Fontcaude - Executive | Juvignac | 28 | 40 | 25 |

Pour ajouter d'autres parcours, editer `seed-courses.js` puis `npm run seed`.

## Theme visuel

Interface inspiree d'un club-house : verts profonds (fairway), parchemin (cream), accent or (trophee). Typo serif pour les titres, scorecard avec couleurs eagle/birdie/par/bogey.

## Flux d'utilisation

1. **Organisateur** ouvre l'URL → "Creer une partie" → choisit parcours et formule → ajoute les joueurs (nom, sexe, index) → "Demarrer la partie"
2. Chaque **joueur** ouvre l'URL ngrok sur son telephone → "Rejoindre la partie" → choisit son nom dans la liste
3. Pendant le tour, n'importe quel joueur peut saisir un score : choisir le joueur, choisir le trou, taper le score sur le pave numerique
4. Le **leaderboard** se met a jour automatiquement en temps reel sur tous les telephones
5. A la fin, l'organisateur clique "Terminer" pour cloturer la partie

## Calcul du handicap (HCP de jeu)

Formule francaise standard :

```
HCP_jeu = round( index * (slope / 113) + (SSS - par) )
```

Repartition des coups recus :
- `base = floor(HCP_jeu / 18)` coups sur chaque trou
- `extras = HCP_jeu mod 18` coup supplementaire sur les trous dont SI <= extras

> **Note importante : index ≠ HCP de jeu.** Sur un parcours difficile (slope eleve, SSS > par), le HCP de jeu peut depasser l'index. Exemple concret : un joueur index 54 sur Massane (slope 135, SSS 74.7, par 72) recoit `round(54*135/113 + 2.7) = 67` coups. Distribution : 4 coups sur les trous SI 1-13, 3 coups sur les trous SI 14-18. Voir un badge `+4` sur la scorecard est donc normal et conforme a la regle officielle FFGolf, meme pour un index plafonne a 54.

## Formules

- **Stroke Play Brut** : somme des coups bruts. Le plus bas gagne.
- **Stroke Play Net** : somme des coups nets (brut - coups recus). Le plus bas gagne.
- **Matchplay Brut/Net (skins)** : sur chaque trou, le score le plus bas (strict) gagne le trou. Plus de trous gagnes = vainqueur.
- **Chicago** : quota = 39 - HCP de jeu. Points par trou (vs par brut) : bogey+ = 1, par = 2, birdie = 4, eagle+ = 8. Score final = points - quota. Le plus haut gagne.

## Limites connues

- Donnees ffgolf disponibles uniquement pour le repere principal hommes (jaunes/blancs selon parcours). Les valeurs slope/SSS sont identiques pour M et F dans cette version.
- Pas d'authentification : l'identite est juste un nom dans la liste.
- Une seule partie active a la fois (creer une nouvelle partie cloture la precedente).

## Structure des fichiers

```
server.js            # Express + Socket.IO + API REST
db.js                # Init SQLite + schema
scoring.js           # Calcul handicap + classements (5 formules)
seed-courses.js      # Donnees parcours (issues de ffgolf.org)
public/
  index.html         # Accueil (creer ou rejoindre)
  setup.html         # Configuration de la partie
  game.html          # Saisie scores + leaderboard live
  style.css
data/golf.db         # Base SQLite (creee au premier lancement)
```
