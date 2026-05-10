require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./db');
const { seed } = require('./seed-courses');
const { computeLeaderboard, playingHandicap, FORMULA_LABELS, MATCHPLAY_FORMULAS } = require('./scoring');

// Seed parcours au demarrage si table vide
const courseCount = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
if (courseCount === 0) seed();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

function getCourseRow(id) {
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    holes: JSON.parse(row.holes_json),
    tees: row.tees_json ? JSON.parse(row.tees_json) : []
  };
}

// Trouve le tee correspondant a (sex, color) dans course.tees.
// Renvoie null si non trouve (le caller utilisera un fallback course.slope/sss).
function findTee(course, sex, color) {
  if (!course.tees || !color) return null;
  return course.tees.find(t => t.sex === sex && t.color === color) || null;
}

// Si loop_twice : on duplique les 9 trous en 1-9 + 10-18, on double par/SSS/slope.
// Le scoring travaille ensuite de maniere transparente sur 18 trous.
// Les valeurs slope/sss des tees sont aussi doublees pour la coherence.
//
// SI : convention FFGolf pour les 9 trous joues 2 fois en 18T.
//   1er passage (trous 1-9)  : SI_18T = SI_9T * 2 - 1 (impairs)
//   2eme passage (trous 10-18) : SI_18T = SI_9T * 2     (pairs)
//   Ainsi chaque trou physique a 2 SI distincts (1 par passage), et les 18 SI
//   couvrent bien 1..18 sans doublon.
function getEffectiveCourse(course, loopTwice) {
  if (!loopTwice || course.holes.length !== 9) return course;
  const first  = course.holes.map(h => ({ num: h.num,     par: h.par, si: h.si * 2 - 1 }));
  const second = course.holes.map(h => ({ num: h.num + 9, par: h.par, si: h.si * 2     }));
  const teesDoubled = (course.tees || []).map(t => ({
    ...t,
    slope: t.slope * 2,
    sss: Math.round(t.sss * 2 * 10) / 10
  }));
  return {
    ...course,
    par_total: course.par_total * 2,
    sss: Math.round(course.sss * 2 * 10) / 10,
    slope: course.slope * 2,
    holes: first.concat(second),
    tees: teesDoubled
  };
}

function getActiveGame() {
  return db.prepare(`SELECT * FROM games WHERE status IN ('setup', 'active') ORDER BY id DESC LIMIT 1`).get();
}

function getGameFull(gameId) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return null;
  const baseCourse = getCourseRow(game.course_id);
  const course = getEffectiveCourse(baseCourse, game.loop_twice);
  const players = db.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY position, id').all(gameId);
  const teams = db.prepare('SELECT * FROM teams WHERE game_id = ? ORDER BY position, id').all(gameId);
  const teamsById = Object.fromEntries(teams.map(t => [t.id, t]));
  const allScores = db.prepare(`
    SELECT s.* FROM scores s
    JOIN players p ON p.id = s.player_id
    WHERE p.game_id = ?
  `).all(gameId);

  const scoresByPlayer = {};
  for (const p of players) scoresByPlayer[p.id] = {};
  for (const s of allScores) {
    if (!scoresByPlayer[s.player_id]) scoresByPlayer[s.player_id] = {};
    scoresByPlayer[s.player_id][s.hole_num] = s.strokes;
  }

  // Enrichit chaque joueur avec slope/sss du tee choisi + objet team complet
  const playersWithTee = players.map(p => {
    const tee = findTee(course, p.sex, p.tee_color);
    return {
      ...p,
      slope: tee ? tee.slope : course.slope,
      sss:   tee ? tee.sss   : course.sss,
      team:  p.team_id ? (teamsById[p.team_id] || null) : null
    };
  });

  const playersEnriched = playersWithTee.map(p => ({
    ...p,
    playingHcp: playingHandicap(p.handicap, p.slope, p.sss, course.par_total)
  }));

  const leaderboard = computeLeaderboard(course, game.formula, playersWithTee, scoresByPlayer, {
    doubles_format: game.doubles_format || null
  });

  return {
    game,
    course,
    formulaLabel: FORMULA_LABELS[game.formula] || game.formula,
    players: playersEnriched,
    teams,
    scores: scoresByPlayer,
    leaderboard
  };
}

function broadcastGame(gameId) {
  const data = getGameFull(gameId);
  if (data) {
    // On retire le code avant le broadcast (les sockets sont deja autorises)
    const safe = { ...data, game: { ...data.game, code: undefined } };
    io.to(`game:${gameId}`).emit('game:update', safe);
  }
}

function genCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Middleware password : protege les routes lecture/ecriture sur une partie precise
function requireGameAuth(req, res, next) {
  const idParam = req.params.id || (req.body && req.body.game_id);
  const id = Number(idParam);
  if (!id) return res.status(400).json({ error: 'game_id manquant' });
  const code = req.headers['x-game-code'] || req.query.code;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  if (game.code && game.code !== code) return res.status(401).json({ error: 'Code invalide' });
  req.game = game;
  next();
}

// ---------- Proxy Claude (pour l'app ASSISTANT mobile) ----------
// Garde la cle Anthropic cote serveur. Le mobile envoie un X-App-Token partage.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

app.post('/api/claude', async (req, res) => {
  const expectedToken = process.env.APP_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!expectedToken || !apiKey) {
    return res.status(500).json({ error: 'Proxy non configure (APP_TOKEN ou ANTHROPIC_API_KEY manquant cote serveur)' });
  }
  const provided = req.header('x-app-token');
  if (!provided || provided !== expectedToken) {
    return res.status(401).json({ error: 'Token invalide' });
  }
  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    console.error('Proxy Claude error:', err);
    res.status(502).json({ error: 'Proxy upstream error', message: err && err.message });
  }
});

// ---------- API publiques ----------

app.get('/api/courses', (req, res) => {
  const rows = db.prepare('SELECT id, name, city, par_total, slope, sss, holes_json, tees_json FROM courses ORDER BY name').all();
  const out = rows.map(r => ({
    id: r.id,
    name: r.name,
    city: r.city,
    par_total: r.par_total,
    slope: r.slope,
    sss: r.sss,
    holes_count: JSON.parse(r.holes_json).length,
    tees: r.tees_json ? JSON.parse(r.tees_json) : []
  }));
  res.json(out);
});

app.get('/api/games/active/exists', (req, res) => {
  const g = getActiveGame();
  if (!g) return res.json({ exists: false });
  res.json({ exists: true, id: g.id, code_required: !!g.code, status: g.status });
});

app.get('/api/games/history', (req, res) => {
  const rows = db.prepare(`
    SELECT g.id, g.formula, g.closed_at, g.loop_twice, c.name AS course_name, c.par_total
    FROM games g
    JOIN courses c ON c.id = g.course_id
    WHERE g.status = 'closed' AND g.closed_at IS NOT NULL
    ORDER BY g.closed_at DESC
    LIMIT 50
  `).all();
  const out = rows.map(g => {
    const players = db.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').get(g.id).n;
    let winner = null;
    try {
      const data = getGameFull(g.id);
      if (data && data.leaderboard.length) winner = data.leaderboard[0].name;
    } catch (e) { /* ignore */ }
    return {
      id: g.id,
      course_name: g.course_name,
      formula_label: FORMULA_LABELS[g.formula] || g.formula,
      closed_at: g.closed_at,
      loop_twice: !!g.loop_twice,
      player_count: players,
      winner
    };
  });
  res.json(out);
});

// Creation de partie (publique, mais cree un code)
app.post('/api/games', (req, res) => {
  const { course_id, formula, loop_twice, doubles_format } = req.body;
  if (!course_id || !formula) return res.status(400).json({ error: 'course_id et formula requis' });
  const baseCourse = getCourseRow(course_id);
  if (!baseCourse) return res.status(404).json({ error: 'Parcours introuvable' });
  if (!FORMULA_LABELS[formula]) return res.status(400).json({ error: 'Formule inconnue' });
  const lt = loop_twice && baseCourse.holes.length === 9 ? 1 : 0;
  // doubles_format : uniquement valide pour match_team
  let df = null;
  if (doubles_format && formula === 'match_team') {
    if (!['best_ball', 'foursome'].includes(doubles_format)) {
      return res.status(400).json({ error: 'doubles_format invalide (best_ball ou foursome)' });
    }
    df = doubles_format;
  }

  // Cloturer toutes les parties en cours
  db.prepare(`UPDATE games SET status = 'closed', closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP) WHERE status IN ('setup', 'active')`).run();

  const code = genCode();
  const r = db.prepare(`INSERT INTO games (course_id, formula, status, code, loop_twice, doubles_format) VALUES (?, ?, 'setup', ?, ?, ?)`)
    .run(course_id, formula, code, lt, df);
  // On renvoie code + full state au createur
  const data = getGameFull(r.lastInsertRowid);
  res.json({ ...data, code }); // code visible UNIQUEMENT a la creation (et via game:full ci-dessous)
});

// ---------- Routes protegees par code ----------

app.get('/api/games/active', requireGameAuth, (req, res) => {
  // requireGameAuth marche par :id, donc on a besoin d'un wrapper specifique
  res.status(400).json({ error: 'Utilise /api/games/:id avec le code' });
});

// Variante : recupere la partie active si pas d'id (necessite le code de la partie active)
app.get('/api/games/active/full', (req, res) => {
  const g = getActiveGame();
  if (!g) return res.json(null);
  const code = req.headers['x-game-code'] || req.query.code;
  if (g.code && g.code !== code) return res.status(401).json({ error: 'Code invalide', game_id: g.id });
  const data = getGameFull(g.id);
  res.json({ ...data, code: g.code });
});

app.get('/api/games/:id', requireGameAuth, (req, res) => {
  const data = getGameFull(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Partie introuvable' });
  // On expose le code pour le createur qui aurait perdu le localStorage
  res.json({ ...data, code: req.game.code });
});

app.post('/api/games/:id/players', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const { name, sex, handicap, tee_color, team_id, pair_index } = req.body;
  if (!name || !sex || handicap == null) return res.status(400).json({ error: 'name, sex, handicap requis' });
  if (!['M', 'F'].includes(sex)) return res.status(400).json({ error: 'sex doit etre M ou F' });
  const hcp = Number(handicap);
  if (Number.isNaN(hcp)) return res.status(400).json({ error: 'handicap invalide' });
  const trimmed = name.trim();

  // Unicite du nom dans ce flight (insensible a la casse / espaces).
  const dup = db.prepare(
    `SELECT id FROM players WHERE game_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`
  ).get(gameId, trimmed);
  if (dup) return res.status(409).json({ error: `Nom deja utilise dans ce flight : ${trimmed}` });

  // Verifie que team_id (si fourni) appartient bien a cette partie
  let teamIdValid = null;
  if (team_id != null && team_id !== '') {
    const t = db.prepare('SELECT id FROM teams WHERE id = ? AND game_id = ?').get(Number(team_id), gameId);
    if (!t) return res.status(400).json({ error: 'Equipe inconnue pour cette partie' });
    teamIdValid = t.id;
  }

  let pairIdxValid = null;
  if (pair_index != null && pair_index !== '') {
    const pi = Number(pair_index);
    if (!Number.isInteger(pi) || pi < 1) return res.status(400).json({ error: 'pair_index invalide' });
    pairIdxValid = pi;
  }

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM players WHERE game_id = ?').get(gameId).m;
  const r = db.prepare(`INSERT INTO players (game_id, name, sex, handicap, position, tee_color, team_id, pair_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(gameId, trimmed, sex, hcp, maxPos + 1, tee_color || null, teamIdValid, pairIdxValid);

  broadcastGame(gameId);
  res.json({ id: r.lastInsertRowid });
});

// ---------- Routes equipes (formule match_team) ----------

const VALID_TEAM_COLORS = ['rouge', 'bleu', 'vert', 'jaune'];

app.post('/api/games/:id/teams', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const { name, color } = req.body;
  if (!name || !color) return res.status(400).json({ error: 'name et color requis' });
  if (!VALID_TEAM_COLORS.includes(color)) return res.status(400).json({ error: `Couleur invalide (rouge/bleu/vert/jaune)` });

  const trimmed = name.trim();
  const teamCount = db.prepare('SELECT COUNT(*) AS n FROM teams WHERE game_id = ?').get(gameId).n;
  if (teamCount >= 4) return res.status(400).json({ error: 'Maximum 4 equipes' });

  const dupName = db.prepare(`SELECT id FROM teams WHERE game_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`).get(gameId, trimmed);
  if (dupName) return res.status(409).json({ error: `Nom d'equipe deja utilise : ${trimmed}` });

  const dupColor = db.prepare(`SELECT id FROM teams WHERE game_id = ? AND color = ?`).get(gameId, color);
  if (dupColor) return res.status(409).json({ error: `Couleur deja utilisee : ${color}` });

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM teams WHERE game_id = ?').get(gameId).m;
  const r = db.prepare(`INSERT INTO teams (game_id, name, color, position) VALUES (?, ?, ?, ?)`)
    .run(gameId, trimmed, color, maxPos + 1);

  broadcastGame(gameId);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/games/:id/teams/:tid', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const tid = Number(req.params.tid);
  // Desassigne les joueurs avant de supprimer l'equipe
  db.prepare('UPDATE players SET team_id = NULL WHERE team_id = ? AND game_id = ?').run(tid, gameId);
  db.prepare('DELETE FROM teams WHERE id = ? AND game_id = ?').run(tid, gameId);
  broadcastGame(gameId);
  res.json({ ok: true });
});

// Update team_id et/ou pair_index d'un joueur (sans recreer le joueur)
app.patch('/api/games/:id/players/:pid', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const pid = Number(req.params.pid);
  const { team_id, pair_index } = req.body;
  if ('team_id' in req.body) {
    if (team_id !== null && team_id !== undefined && team_id !== '') {
      const t = db.prepare('SELECT id FROM teams WHERE id = ? AND game_id = ?').get(Number(team_id), gameId);
      if (!t) return res.status(400).json({ error: 'Equipe inconnue pour cette partie' });
      db.prepare('UPDATE players SET team_id = ? WHERE id = ? AND game_id = ?').run(Number(team_id), pid, gameId);
    } else {
      db.prepare('UPDATE players SET team_id = NULL WHERE id = ? AND game_id = ?').run(pid, gameId);
    }
  }
  if ('pair_index' in req.body) {
    if (pair_index !== null && pair_index !== undefined && pair_index !== '') {
      const pi = Number(pair_index);
      if (!Number.isInteger(pi) || pi < 1) return res.status(400).json({ error: 'pair_index invalide' });
      db.prepare('UPDATE players SET pair_index = ? WHERE id = ? AND game_id = ?').run(pi, pid, gameId);
    } else {
      db.prepare('UPDATE players SET pair_index = NULL WHERE id = ? AND game_id = ?').run(pid, gameId);
    }
  }
  broadcastGame(gameId);
  res.json({ ok: true });
});

// Update doubles_format de la partie (uniquement match_team, en setup)
app.patch('/api/games/:id', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  if (game.status !== 'setup') return res.status(400).json({ error: 'Partie deja demarree' });

  if ('doubles_format' in req.body) {
    if (game.formula !== 'match_team') {
      return res.status(400).json({ error: 'doubles_format reserve a match_team' });
    }
    const v = req.body.doubles_format;
    if (v && !['best_ball', 'foursome'].includes(v)) {
      return res.status(400).json({ error: 'doubles_format invalide (best_ball ou foursome)' });
    }
    db.prepare('UPDATE games SET doubles_format = ? WHERE id = ?').run(v || null, gameId);
    // Si on revient en singles : reset les pair_index pour cette partie
    if (!v) {
      db.prepare('UPDATE players SET pair_index = NULL WHERE game_id = ?').run(gameId);
    }
  }
  broadcastGame(gameId);
  res.json({ ok: true });
});

// Reordonne tous les joueurs d'un coup : body = { order: [pid1, pid2, ...] }
app.post('/api/games/:id/players/reorder', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order (array) requis' });
  const tx = db.transaction(() => {
    order.forEach((pid, i) => {
      db.prepare('UPDATE players SET position = ? WHERE id = ? AND game_id = ?')
        .run(i + 1, Number(pid), gameId);
    });
  });
  tx();
  broadcastGame(gameId);
  res.json({ ok: true });
});

// Reordonne un joueur dans la liste : direction = 'up' ou 'down'
app.post('/api/games/:id/players/:pid/move', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const pid = Number(req.params.pid);
  const direction = req.body && req.body.direction;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction doit etre up ou down' });

  const players = db.prepare('SELECT id, position FROM players WHERE game_id = ? ORDER BY position, id').all(gameId);
  const idx = players.findIndex(p => p.id === pid);
  if (idx === -1) return res.status(404).json({ error: 'Joueur introuvable' });
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= players.length) return res.json({ ok: true }); // deja aux extremites

  // Echange des positions (les positions reelles peuvent etre quelconques, on les normalise)
  const a = players[idx];
  const b = players[swapIdx];
  const tx = db.transaction(() => {
    db.prepare('UPDATE players SET position = ? WHERE id = ?').run(b.position, a.id);
    db.prepare('UPDATE players SET position = ? WHERE id = ?').run(a.position, b.id);
  });
  tx();

  broadcastGame(gameId);
  res.json({ ok: true });
});

app.delete('/api/games/:id/players/:pid', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const pid = Number(req.params.pid);
  db.prepare('DELETE FROM players WHERE id = ? AND game_id = ?').run(pid, gameId);
  broadcastGame(gameId);
  res.json({ ok: true });
});

app.post('/api/games/:id/start', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  const players = db.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').get(gameId).n;
  if (players < 1) return res.status(400).json({ error: 'Au moins 1 joueur requis' });
  if (MATCHPLAY_FORMULAS.includes(game.formula)) {
    if (players < 2) return res.status(400).json({ error: 'Matchplay : 2 joueurs minimum' });
    if (players % 2 !== 0) return res.status(400).json({ error: 'Matchplay : nombre pair de joueurs requis (2, 4, 6...)' });
  }
  // Validation specifique match_team : equipes definies + paires cross-team
  if (game.formula === 'match_team') {
    const teamRows = db.prepare('SELECT id FROM teams WHERE game_id = ?').all(gameId);
    if (teamRows.length < 2) return res.status(400).json({ error: 'Match Play par equipes : 2 equipes minimum requises' });
    if (teamRows.length > 4) return res.status(400).json({ error: 'Match Play par equipes : 4 equipes maximum' });

    const playersList = db.prepare('SELECT id, name, team_id, pair_index FROM players WHERE game_id = ? ORDER BY position, id').all(gameId);
    const unassigned = playersList.filter(p => !p.team_id);
    if (unassigned.length) {
      return res.status(400).json({ error: `${unassigned.length} joueur(s) sans equipe : ${unassigned.map(p => p.name).join(', ')}` });
    }

    if (game.doubles_format) {
      // Mode doubles : chaque pair_index doit avoir 2 joueurs par equipe presente,
      // et il faut au moins 2 equipes ayant la meme pair_index
      const noPair = playersList.filter(p => !p.pair_index);
      if (noPair.length) {
        return res.status(400).json({ error: `${noPair.length} joueur(s) sans paire : ${noPair.map(p => p.name).join(', ')}` });
      }
      const groups = {}; // "teamId:pairIdx" -> [names]
      for (const p of playersList) {
        const k = `${p.team_id}:${p.pair_index}`;
        if (!groups[k]) groups[k] = [];
        groups[k].push(p.name);
      }
      for (const k in groups) {
        if (groups[k].length !== 2) {
          return res.status(400).json({ error: `Paire ${k.split(':')[1]} dans une equipe : ${groups[k].length} joueur(s) au lieu de 2 (${groups[k].join(', ')})` });
        }
      }
      // Au moins 2 equipes par pair_index
      const byIdx = {}; // pairIdx -> Set(teamId)
      for (const p of playersList) {
        if (!byIdx[p.pair_index]) byIdx[p.pair_index] = new Set();
        byIdx[p.pair_index].add(p.team_id);
      }
      for (const idx in byIdx) {
        if (byIdx[idx].size < 2) {
          return res.status(400).json({ error: `Paire ${idx} : pas d'adversaire (manque une paire dans une autre equipe)` });
        }
      }
    } else {
      // Singles classique : appariement par position consecutive cross-team
      for (let i = 0; i + 1 < playersList.length; i += 2) {
        if (playersList[i].team_id === playersList[i + 1].team_id) {
          return res.status(400).json({
            error: `Match ${(i / 2) + 1} : ${playersList[i].name} et ${playersList[i + 1].name} sont dans la meme equipe (interdit)`
          });
        }
      }
    }
  }
  db.prepare(`UPDATE games SET status = 'active' WHERE id = ?`).run(gameId);
  broadcastGame(gameId);
  res.json(getGameFull(gameId));
});

app.post('/api/games/:id/scores', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const { player_id, hole_num, strokes } = req.body;
  if (!player_id || !hole_num) return res.status(400).json({ error: 'player_id et hole_num requis' });

  const player = db.prepare('SELECT * FROM players WHERE id = ? AND game_id = ?').get(player_id, gameId);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable dans cette partie' });

  // En doubles (Ryder) : on propage le score au partenaire (meme team_id + meme pair_index)
  const game = db.prepare('SELECT doubles_format, formula FROM games WHERE id = ?').get(gameId);
  let targetIds = [Number(player_id)];
  if (game && game.formula === 'match_team' && game.doubles_format && player.team_id && player.pair_index) {
    const partners = db.prepare(
      'SELECT id FROM players WHERE game_id = ? AND team_id = ? AND pair_index = ? AND id != ?'
    ).all(gameId, player.team_id, player.pair_index, player.id);
    for (const pn of partners) targetIds.push(pn.id);
  }

  if (strokes == null || strokes === '') {
    const stmt = db.prepare('DELETE FROM scores WHERE player_id = ? AND hole_num = ?');
    const tx = db.transaction(() => { for (const id of targetIds) stmt.run(id, hole_num); });
    tx();
  } else {
    const s = Number(strokes);
    if (!Number.isInteger(s) || s < 1 || s > 20) return res.status(400).json({ error: 'Score invalide (1-20)' });
    const stmt = db.prepare(`
      INSERT INTO scores (player_id, hole_num, strokes) VALUES (?, ?, ?)
      ON CONFLICT(player_id, hole_num) DO UPDATE SET strokes = excluded.strokes
    `);
    const tx = db.transaction(() => { for (const id of targetIds) stmt.run(id, hole_num, s); });
    tx();
  }

  broadcastGame(gameId);
  res.json({ ok: true });
});

// PIN requis pour fermer la partie (anti-clic accidentel ou par autre joueur)
// Override possible via env FINISH_PIN ; valeur par defaut : 2749
const FINISH_PIN = process.env.FINISH_PIN || '2749';

app.post('/api/games/:id/finish', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
  const { pin } = req.body || {};
  if (String(pin || '') !== FINISH_PIN) {
    return res.status(401).json({ error: 'Code PIN invalide' });
  }
  db.prepare(`UPDATE games SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(gameId);
  broadcastGame(gameId);
  res.json({ ok: true });
});

// ---------- Telechargement scorecard ----------

function buildCsv(data) {
  const BOM = '﻿';
  const sep = ',';
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  lines.push(['Parcours', 'Formule', 'Date', 'Code partie'].map(esc).join(sep));
  lines.push([
    data.course.name,
    data.formulaLabel,
    data.game.closed_at || data.game.created_at,
    data.game.code || ''
  ].map(esc).join(sep));
  lines.push('');
  lines.push(['Rang', 'Joueur', 'Sexe', 'Index', 'HCP de jeu', 'Trous joues', 'Brut', 'Score formule'].map(esc).join(sep));
  for (const r of data.leaderboard) {
    // En doubles : r.playerId = "pair:tid:idx", on prend les coups d'un des 2 joueurs
    const realId = (r.pairPlayerIds && r.pairPlayerIds[0]) || r.playerId;
    const player = data.players.find(p => p.id === realId);
    const grossTotal = Object.values(data.scores[realId] || {}).reduce((s, v) => s + v, 0);
    lines.push([
      r.rank,
      r.name,
      player ? (player.sex === 'M' ? 'H' : 'F') : '',
      r.handicap,
      r.playingHcp,
      r.holesPlayed,
      grossTotal,
      r.scoreLabel
    ].map(esc).join(sep));
  }
  lines.push('');
  lines.push('Detail trou par trou (brut)');
  const holeNums = data.course.holes.map(h => h.num);
  lines.push(['Joueur', ...holeNums.map(n => `T${n}`), 'Total'].map(esc).join(sep));
  for (const p of data.players) {
    const ps = data.scores[p.id] || {};
    const cells = holeNums.map(n => ps[n] != null ? ps[n] : '');
    const total = Object.values(ps).reduce((s, v) => s + v, 0);
    lines.push([p.name, ...cells, total].map(esc).join(sep));
  }
  return BOM + lines.join('\r\n');
}

app.get('/api/games/:id/scorecard.csv', requireGameAuth, (req, res) => {
  const data = getGameFull(Number(req.params.id));
  if (!data) return res.status(404).send('Partie introuvable');
  const csv = buildCsv({ ...data, game: { ...data.game, code: req.game.code } });
  const filename = `scorecard-${data.course.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${data.game.id}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// ---------- Socket.IO (auth par code) ----------

io.on('connection', (socket) => {
  socket.on('join', (payload) => {
    // payload: { gameId, code }
    const gameId = Number(payload && payload.gameId);
    const code = payload && payload.code;
    if (!gameId) return;
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) { socket.emit('auth:fail', { reason: 'not_found' }); return; }
    if (game.code && game.code !== code) { socket.emit('auth:fail', { reason: 'bad_code' }); return; }
    socket.join(`game:${gameId}`);
    const data = getGameFull(gameId);
    if (data) {
      const safe = { ...data, game: { ...data.game, code: undefined } };
      socket.emit('game:update', safe);
    }
  });
});

// ---------- Start ----------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Leaderboard golf en ecoute sur http://localhost:${PORT}`);
});
