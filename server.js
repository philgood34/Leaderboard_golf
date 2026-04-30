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

  // Enrichit chaque joueur avec slope/sss du tee choisi (fallback course par defaut)
  const playersWithTee = players.map(p => {
    const tee = findTee(course, p.sex, p.tee_color);
    return {
      ...p,
      slope: tee ? tee.slope : course.slope,
      sss:   tee ? tee.sss   : course.sss
    };
  });

  const playersEnriched = playersWithTee.map(p => ({
    ...p,
    playingHcp: playingHandicap(p.handicap, p.slope, p.sss, course.par_total)
  }));

  const leaderboard = computeLeaderboard(course, game.formula, playersWithTee, scoresByPlayer);

  return {
    game,
    course,
    formulaLabel: FORMULA_LABELS[game.formula] || game.formula,
    players: playersEnriched,
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
  const { course_id, formula, loop_twice } = req.body;
  if (!course_id || !formula) return res.status(400).json({ error: 'course_id et formula requis' });
  const baseCourse = getCourseRow(course_id);
  if (!baseCourse) return res.status(404).json({ error: 'Parcours introuvable' });
  if (!FORMULA_LABELS[formula]) return res.status(400).json({ error: 'Formule inconnue' });
  const lt = loop_twice && baseCourse.holes.length === 9 ? 1 : 0;

  // Cloturer toutes les parties en cours
  db.prepare(`UPDATE games SET status = 'closed', closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP) WHERE status IN ('setup', 'active')`).run();

  const code = genCode();
  const r = db.prepare(`INSERT INTO games (course_id, formula, status, code, loop_twice) VALUES (?, ?, 'setup', ?, ?)`)
    .run(course_id, formula, code, lt);
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
  const { name, sex, handicap, tee_color } = req.body;
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

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM players WHERE game_id = ?').get(gameId).m;
  const r = db.prepare(`INSERT INTO players (game_id, name, sex, handicap, position, tee_color) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(gameId, trimmed, sex, hcp, maxPos + 1, tee_color || null);

  broadcastGame(gameId);
  res.json({ id: r.lastInsertRowid });
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

  if (strokes == null || strokes === '') {
    db.prepare('DELETE FROM scores WHERE player_id = ? AND hole_num = ?').run(player_id, hole_num);
  } else {
    const s = Number(strokes);
    if (!Number.isInteger(s) || s < 1 || s > 20) return res.status(400).json({ error: 'Score invalide (1-20)' });
    db.prepare(`
      INSERT INTO scores (player_id, hole_num, strokes) VALUES (?, ?, ?)
      ON CONFLICT(player_id, hole_num) DO UPDATE SET strokes = excluded.strokes
    `).run(player_id, hole_num, s);
  }

  broadcastGame(gameId);
  res.json({ ok: true });
});

app.post('/api/games/:id/finish', requireGameAuth, (req, res) => {
  const gameId = Number(req.params.id);
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
    const player = data.players.find(p => p.id === r.playerId);
    const grossTotal = Object.values(data.scores[r.playerId] || {}).reduce((s, v) => s + v, 0);
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
server.listen(PORT, async () => {
  console.log(`Leaderboard golf en ecoute sur http://localhost:${PORT}`);
  if (process.env.NGROK_API) {
    try {
      const ngrok = require('@ngrok/ngrok');
      const listener = await ngrok.connect({ addr: PORT, authtoken: process.env.NGROK_API });
      console.log(`\n  Ngrok actif : ${listener.url()}`);
      console.log(`  Partage cette URL aux joueurs.\n`);
    } catch (e) {
      console.warn('Ngrok non demarre :', e.message);
    }
  } else {
    console.log(`Pour exposer via ngrok : place NGROK_API=<token> dans .env`);
  }
});
