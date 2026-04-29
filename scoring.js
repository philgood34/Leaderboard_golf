// Moteur de scoring : handicap de jeu, repartition des coups rendus,
// et calcul du classement pour chaque formule.

const FORMULAS = {
  STROKE_BRUT: 'stroke_brut',
  STROKE_NET:  'stroke_net',
  MATCH_BRUT:  'match_brut',
  MATCH_NET:   'match_net',
  CHICAGO:     'chicago'
};

const FORMULA_LABELS = {
  stroke_brut: 'Stroke Play Brut',
  stroke_net:  'Stroke Play Net',
  match_brut:  'Matchplay Brut',
  match_net:   'Matchplay Net',
  chicago:     'Chicago'
};

// Liste des formules matchplay (utilises par le serveur pour valider le nombre pair de joueurs)
const MATCHPLAY_FORMULAS = ['match_brut', 'match_net'];

// HCP de jeu (course handicap) = round(index * slope/113 + (SSS - par))
function playingHandicap(hcpIndex, slope, sss, parTotal) {
  return Math.round(hcpIndex * (slope / 113) + (sss - parTotal));
}

// Coups rendus sur un trou donne en fonction du HCP de jeu et du Stroke Index.
// HCP positif : le joueur RECOIT des coups (valeur >= 0).
// HCP negatif : le joueur DONNE des coups (valeur <= 0).
function strokesOnHole(playingHcp, si) {
  if (playingHcp >= 0) {
    const base = Math.floor(playingHcp / 18);
    const extras = playingHcp % 18;
    return base + (si <= extras ? 1 : 0);
  } else {
    const n = -playingHcp;
    const base = Math.floor(n / 18);
    const extras = n % 18;
    return -(base + (si > 18 - extras ? 1 : 0));
  }
}

// Points Chicago (gross vs par) : bogey+ = 1, par = 2, birdie = 4, eagle+ = 8.
function chicagoPoints(grossStrokes, par) {
  const diff = grossStrokes - par;
  if (diff <= -2) return 8;
  if (diff === -1) return 4;
  if (diff === 0)  return 2;
  return 1; // bogey ou pire
}

// Construit le classement.
// course = { par_total, slope, sss, holes: [{num, par, si}] }
// players = [{ id, name, sex, handicap }]
// scoresByPlayer = { [playerId]: { [holeNum]: strokes } }
function computeLeaderboard(course, formula, players, scoresByPlayer) {
  const holes = course.holes;
  const enriched = players.map(p => {
    const playingHcp = playingHandicap(p.handicap, course.slope, course.sss, course.par_total);
    const playerScores = scoresByPlayer[p.id] || {};
    const perHole = holes.map(h => {
      const strokes = playerScores[h.num];
      const recv = strokesOnHole(playingHcp, h.si);
      const net = (strokes != null) ? (strokes - recv) : null;
      return {
        num: h.num,
        par: h.par,
        si: h.si,
        strokes,
        strokesReceived: recv,
        net
      };
    });
    const holesPlayed = perHole.filter(h => h.strokes != null).length;
    const grossTotal = perHole.reduce((s, h) => s + (h.strokes ?? 0), 0);
    const netTotal = perHole.reduce((s, h) => s + (h.net ?? 0), 0);
    return {
      id: p.id,
      name: p.name,
      sex: p.sex,
      handicap: p.handicap,
      playingHcp,
      perHole,
      holesPlayed,
      grossTotal,
      netTotal
    };
  });

  switch (formula) {
    case FORMULAS.STROKE_BRUT:
      return rankStroke(enriched, 'gross', course.par_total);
    case FORMULAS.STROKE_NET:
      return rankStroke(enriched, 'net', course.par_total);
    case FORMULAS.MATCH_BRUT:
      return rankMatchplayStandard(enriched, course.holes, false);
    case FORMULAS.MATCH_NET:
      return rankMatchplayStandard(enriched, course.holes, true);
    case FORMULAS.CHICAGO:
      return rankChicago(enriched, course.holes);
    default:
      throw new Error(`Formule inconnue : ${formula}`);
  }
}

function rankStroke(enriched, mode, parTotal) {
  const rows = enriched.map(p => {
    const total = mode === 'gross' ? p.grossTotal : p.netTotal;
    // par "joue" : somme des pars des trous joues
    const parPlayed = p.perHole
      .filter(h => h.strokes != null)
      .reduce((s, h) => s + h.par, 0);
    const vsPar = total - parPlayed;
    return {
      playerId: p.id,
      name: p.name,
      handicap: p.handicap,
      playingHcp: p.playingHcp,
      holesPlayed: p.holesPlayed,
      score: total,
      scoreLabel: total === 0 && p.holesPlayed === 0 ? '-' : String(total),
      vsPar,
      vsParLabel: p.holesPlayed === 0 ? '-' : (vsPar === 0 ? 'E' : (vsPar > 0 ? `+${vsPar}` : `${vsPar}`)),
      sortKey: p.holesPlayed === 0 ? Infinity : total
    };
  });
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return assignRanks(rows);
}

// Matchplay standard : les joueurs sont apparies 2 par 2 selon leur ordre.
// Chaque paire est un match independant ; on suit le differentiel "X up / X down" trou par trou.
// Si |diff| > trous restants, le match est cloture (X&Y).
function rankMatchplayStandard(enriched, holes, useNet) {
  const totalHoles = holes.length;
  const pairs = [];
  for (let i = 0; i + 1 < enriched.length; i += 2) {
    pairs.push([enriched[i], enriched[i + 1]]);
  }

  const rows = [];

  pairs.forEach((pair, idx) => {
    const matchNum = idx + 1;
    const [p1, p2] = pair;

    let diff = 0; // > 0 : p1 mene
    let holesPlayedTogether = 0;
    let closedDiff = null;
    let closedRemaining = null;

    for (const h of holes) {
      const ph1 = p1.perHole.find(x => x.num === h.num);
      const ph2 = p2.perHole.find(x => x.num === h.num);
      if (!ph1 || !ph2 || ph1.strokes == null || ph2.strokes == null) continue;

      const s1 = useNet ? ph1.net : ph1.strokes;
      const s2 = useNet ? ph2.net : ph2.strokes;
      if (s1 < s2) diff += 1;
      else if (s2 < s1) diff -= 1;

      holesPlayedTogether += 1;

      if (closedDiff === null) {
        const remaining = totalHoles - holesPlayedTogether;
        if (Math.abs(diff) > remaining) {
          closedDiff = diff;
          closedRemaining = remaining;
        }
      }
    }

    let status, labelP1, labelP2, leaderId;

    if (closedDiff !== null) {
      status = 'closed';
      const absD = Math.abs(closedDiff);
      const tag = closedRemaining === 0 ? `${absD} up` : `${absD}&${closedRemaining}`;
      if (closedDiff > 0) {
        labelP1 = `Gagne ${tag}`;
        labelP2 = `Perd ${tag}`;
        leaderId = p1.id;
      } else {
        labelP1 = `Perd ${tag}`;
        labelP2 = `Gagne ${tag}`;
        leaderId = p2.id;
      }
    } else if (holesPlayedTogether === totalHoles) {
      if (diff === 0) {
        status = 'final_AS';
        labelP1 = labelP2 = 'AS';
        leaderId = null;
      } else {
        status = 'final';
        const absD = Math.abs(diff);
        if (diff > 0) {
          labelP1 = `Gagne ${absD} up`;
          labelP2 = `Perd ${absD}`;
          leaderId = p1.id;
        } else {
          labelP1 = `Perd ${absD}`;
          labelP2 = `Gagne ${absD} up`;
          leaderId = p2.id;
        }
      }
    } else {
      status = 'ongoing';
      if (diff === 0) {
        labelP1 = labelP2 = 'AS';
        leaderId = null;
      } else {
        const absD = Math.abs(diff);
        if (diff > 0) {
          labelP1 = `${absD} UP`;
          labelP2 = `${absD} DOWN`;
          leaderId = p1.id;
        } else {
          labelP1 = `${absD} DOWN`;
          labelP2 = `${absD} UP`;
          leaderId = p2.id;
        }
      }
    }

    [p1, p2].forEach((p, posInPair) => {
      const personalDiff = posInPair === 0 ? diff : -diff;
      const opponent = posInPair === 0 ? p2 : p1;
      rows.push({
        playerId: p.id,
        name: p.name,
        handicap: p.handicap,
        playingHcp: p.playingHcp,
        holesPlayed: p.holesPlayed,
        score: personalDiff,
        scoreLabel: posInPair === 0 ? labelP1 : labelP2,
        vsPar: null,
        vsParLabel: '',
        matchNum,
        matchStatus: status,
        isLeader: leaderId === p.id,
        opponentId: opponent.id,
        opponentName: opponent.name,
        sortKey: matchNum * 1000 - personalDiff
      });
    });
  });

  // Joueur orphelin (nombre impair) — ne devrait pas arriver avec la validation cote serveur
  const pairedIds = new Set(rows.map(r => r.playerId));
  for (const p of enriched) {
    if (pairedIds.has(p.id)) continue;
    rows.push({
      playerId: p.id,
      name: p.name,
      handicap: p.handicap,
      playingHcp: p.playingHcp,
      holesPlayed: p.holesPlayed,
      score: 0,
      scoreLabel: 'Sans adversaire',
      vsPar: null,
      vsParLabel: '',
      matchNum: 999,
      matchStatus: 'no_pair',
      isLeader: false,
      opponentId: null,
      opponentName: null,
      sortKey: 999000
    });
  }

  rows.sort((a, b) => a.sortKey - b.sortKey);
  return assignRanks(rows);
}

function rankChicago(enriched, holes) {
  const rows = enriched.map(p => {
    const quota = 39 - p.playingHcp;
    let pts = 0;
    for (const ph of p.perHole) {
      if (ph.strokes == null) continue;
      pts += chicagoPoints(ph.strokes, ph.par);
    }
    const final = pts - quota;
    return {
      playerId: p.id,
      name: p.name,
      handicap: p.handicap,
      playingHcp: p.playingHcp,
      holesPlayed: p.holesPlayed,
      score: final,
      scoreLabel: `${final >= 0 ? '+' : ''}${final} (${pts}/${quota})`,
      vsPar: null,
      vsParLabel: '',
      sortKey: -final
    };
  });
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return assignRanks(rows);
}

function assignRanks(rows) {
  let lastKey = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (r.sortKey !== lastKey) {
      lastRank = i + 1;
      lastKey = r.sortKey;
    }
    r.rank = lastRank;
  });
  return rows;
}

module.exports = {
  FORMULAS,
  FORMULA_LABELS,
  MATCHPLAY_FORMULAS,
  playingHandicap,
  strokesOnHole,
  computeLeaderboard
};
