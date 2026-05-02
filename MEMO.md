# 📋 MEMO — Leaderboard Golf

> **Fiche de reprise du projet.** À lire si tu reviens dessus après une longue pause et que tu as tout oublié.
>
> 🗓️ Document créé le **28 avril 2026**.
> Tient à jour : URLs, comptes, comment modifier, comment redéployer.

---

## 🎯 De quoi s'agit-il ?

Application web pour suivre les scores d'une partie de golf en direct, avec leaderboard live multi-joueurs. Plusieurs formules : Stroke Play, Matchplay, Chicago, Match Play par équipes (Ryder Cup). Mobile-first (chacun saisit ses scores sur son téléphone).

Hébergée sur le compte GitHub `philgood34`, déployée sur Render.

---

## 🔗 URLs importantes

| Quoi | URL |
|---|---|
| **App live (production)** | https://philgood34.fr |
| **App live (URL Render directe, fallback)** | https://leaderboard-ti1u.onrender.com |
| **Code source (GitHub)** | https://github.com/philgood34/Leaderboard_golf |
| **Dashboard Render (hébergement)** | https://dashboard.render.com |
| **Manager OVH (DNS du domaine)** | https://www.ovh.com/manager/ |
| **GitHub (mon profil)** | https://github.com/philgood34 |

---

## 🔐 Comptes utilisés

Mots de passe : **stockés dans Dashlane**.

| Service | Identifiant | À quoi ça sert |
|---|---|---|
| **GitHub** | `philgood34` | Stocke le code source |
| **Render** | (connexion via GitHub) | Héberge l'app, redéploie auto |
| **OVH** | (compte perso) | Gère le domaine `philgood34.fr` |

> 💡 Render se connecte avec ton compte GitHub — pas besoin d'un mot de passe séparé.

---

## 🏗️ Comment ça marche en 30 secondes

1. **Le code est sur GitHub** (`philgood34/Leaderboard_golf`)
2. **Render surveille ce dépôt** : à chaque modification, il télécharge le code et le déploie automatiquement
3. **OVH (DNS)** dirige le domaine `philgood34.fr` vers les serveurs de Render
4. **L'utilisateur final** ouvre `philgood34.fr` sur son téléphone → tombe sur l'app

```
       Push code        Auto-deploy        DNS pointe vers
GitHub ──────────► Render ◄─────────── OVH (philgood34.fr)
                    │
                    ▼
            Utilisateur final
            (https://philgood34.fr)
```

---

## 🏌️ Inviter des amis à une partie

### Le workflow simple (sans rien à installer pour eux)

1. **Tu ouvres l'app** sur ton tel (ouvre 5 min avant pour la "réveiller" — Render cold start)
2. **Tu crées la partie** : parcours + formule + ajout des joueurs
3. Un **code 4 chiffres** s'affiche (ex: `1738`)
4. **Tu envoies ce message** dans le groupe WhatsApp / SMS :

```
🏌️ Partie de golf en cours !

Pour rejoindre :
👉 https://philgood34.fr
🔢 Code : XXXX

Ouvre le lien, tape le code, choisis ton nom dans la liste. C'est parti !
```

5. Tes amis cliquent → tapent le code → choisissent leur nom → ils sont dedans
6. **Aucune app à installer, aucun compte, aucun mot de passe**

> 💡 Sauvegarde ce modèle de message dans tes Notes / Dashlane pour pouvoir le copier-coller à chaque partie.

### QR code (pour les parties au club-house)

Tu peux générer **un QR code permanent** vers `https://philgood34.fr` :
1. Va sur https://www.qr-code-generator.com
2. Type "URL", colle `https://philgood34.fr`, télécharge le PNG
3. Sauvegarde l'image dans ton téléphone (galerie)

Le jour J, tu montres le QR à tes amis, ils le scannent avec leur appareil photo → ils arrivent direct sur l'appli. Tu leur donnes ensuite le code 4 chiffres oralement.

### "Comme une vraie app" (pour tes amis qui jouent souvent)

L'appli peut être ajoutée à l'écran d'accueil comme une app native (sans passer par l'App Store) :

- **iPhone (Safari)** : ouvre l'appli → bouton Partager → "Sur l'écran d'accueil"
- **Android (Chrome)** : ouvre l'appli → menu "..." → "Ajouter à l'écran d'accueil"

Une icône avec le drapeau doré apparaît, et l'appli s'ouvre en plein écran sans la barre du navigateur.

### Conseils pratiques

- ⏰ **Réveille Render avant le départ** : ouvre `philgood34.fr` 5-10 min avant le 1er coup pour éviter le cold start de 50 sec
- 🔢 **Donne le code à voix haute** au tee du 1 plutôt que par message : plus convivial et tu vois en direct qui est connecté
- 🆘 **Backup** : si `philgood34.fr` déconne, l'URL `https://leaderboard-ti1u.onrender.com` marche aussi

### Workflow type "samedi golf"

| Heure | Action |
|---|---|
| 9h00 | Ouvrir `philgood34.fr` pour réveiller Render |
| 9h05 | Créer la partie (parcours, formule, joueurs) |
| 9h10 | Envoyer le code aux amis sur WhatsApp |
| 9h15 | Au tee 1, vérifier que tous ont rejoint |
| 9h20 | 🏌️ Premier coup |

---

## ✏️ Comment modifier le code (méthode débutant — sans ligne de commande)

### Méthode A — Directement sur GitHub (la plus simple)

1. Va sur https://github.com/philgood34/Leaderboard_golf
2. Clique sur le fichier que tu veux modifier (ex: `public/index.html`)
3. Clique sur l'**icône crayon ✏️** en haut à droite du fichier
4. Modifie le contenu
5. En bas, écris un message de commit court (ex: "Correction du titre")
6. Clique le bouton vert **"Commit changes"**

➡️ Render détecte automatiquement la modification et **redéploie l'app dans les 3 à 5 minutes**.

### Méthode B — Avec VS Code (si tu installes git plus tard)

1. Ouvre le dossier du projet dans VS Code
2. Modifie les fichiers
3. Onglet "Source Control" (icône 3ème de la barre de gauche)
4. Tape un message de commit, clique ✓ "Commit"
5. Clique "..." → "Push" pour envoyer sur GitHub

---

## 🚀 Suivre un déploiement Render

Après un commit GitHub :

1. Va sur https://dashboard.render.com
2. Clique sur le service **`leaderboard`**
3. L'onglet **Events** ou **Logs** montre le déploiement en cours
4. Statut **"Live"** (vert) en haut = c'est OK, l'app est à jour
5. Si statut **"Deploy failed"** (rouge) = erreur, lire les logs

---

## ⚠️ Limites connues (Render plan gratuit)

### 1. Cold start (50 secondes)
Si l'app n'a pas eu de visite pendant **15 minutes**, elle s'endort. La première requête met **30-50 secondes** à répondre. Astuce : ouvre l'URL 1-2 min avant une partie pour la "réveiller".

### 2. Base de données éphémère
La base SQLite (`data/golf.db`) est **réinitialisée à chaque redéploiement** ou redémarrage automatique. Ça veut dire :
- ✅ Les **parcours de golf** sont rechargés tout seul (seed automatique)
- ❌ L'**historique des parties terminées** est perdu

Pour conserver l'historique de manière permanente, il faudrait :
- Soit passer Render en payant (~7 €/mois) avec disque persistant
- Soit migrer vers un VPS OVH (~3,50 €/mois)
- Soit utiliser un stockage externe (PostgreSQL gratuit chez Render)

### 3. 750h gratuites/mois
Largement suffisant (un mois fait 720h). Pas un souci.

---

## 🆘 Problèmes courants

### "Le site ne répond pas"
1. Vérifier l'URL Render : https://leaderboard-ti1u.onrender.com
2. Si OK → souci de DNS/domaine, voir OVH
3. Si KO → souci de l'app, voir Render dashboard

### "Pas vu mes modifs après un commit"
1. Aller sur Render → Events : voir si le déploiement est en cours/réussi
2. Vider le cache du navigateur (Ctrl+Maj+R)
3. Tester en navigation privée

### "philgood34.fr ne marche plus"
1. Tester l'URL Render directe d'abord (https://leaderboard-ti1u.onrender.com)
2. Si elle marche → vérifier les enregistrements DNS sur OVH (zone DNS) :
   - `@` A → `216.24.57.1`
   - `www` CNAME → `leaderboard-ti1u.onrender.com.`
3. Vérifier sur https://dnschecker.org

### "Build failed sur Render"
- Lire les logs sur Render dashboard
- 90% du temps c'est `better-sqlite3` qui n'a pas pu se compiler → relancer le déploiement manuellement (bouton "Manual Deploy")

---

## 🧹 À faire (si pas encore fait)

- [ ] Supprimer le dossier `node_modules` local pour gagner ~200 Mo (régénérable avec `npm install` si besoin un jour)
- [ ] Mettre l'URL `https://philgood34.fr` en favori du navigateur

### Améliorations sécurité (optionnelles, à voir plus tard)

- [ ] **Rate limiting** sur l'API (ex: `express-rate-limit`, max 100 req/min par IP) pour éviter les abus
- [ ] **Sanitization** plus stricte des entrées utilisateur (noms de joueurs, équipes, parcours) — actuellement on échappe le HTML à l'affichage mais pas à l'insertion DB
- [ ] **Helmet.js** pour headers HTTP sécurité (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

---

## 📚 Comprendre la stack technique (pour aller plus loin)

| Tech | Rôle |
|---|---|
| **Node.js** | Le langage du serveur (JavaScript côté serveur) |
| **Express** | Le framework web (gère les pages et les routes) |
| **Socket.IO** | Met à jour les leaderboards en temps réel |
| **better-sqlite3** | Base de données légère, fichier unique |
| **HTML/CSS/JS vanilla** | Frontend sans framework (pas de React/Vue) |

**Structure des fichiers** :
- `server.js` — point d'entrée, démarre l'application
- `db.js` — initialise la base SQLite
- `scoring.js` — calcule les classements (handicaps, formules)
- `seed-courses.js` — données des 11 parcours de l'Hérault
- `public/` — les pages HTML/CSS/JS visibles par l'utilisateur

Pour les détails complets, lire le fichier **`README.md`**.

---

## 📞 Contacts

- **Hébergement** : moi (philgood34)

---

## 🔄 Historique des changements

- **28/04/2026** : Première mise en ligne. Migration GitHub Pages → Render. Domaine `philgood34.fr` connecté à Render via OVH DNS. HTTPS auto via Let's Encrypt.

---

> 💡 **Conseil** : mets à jour cette fiche à chaque modification importante. Future-toi te remerciera. 🙏
