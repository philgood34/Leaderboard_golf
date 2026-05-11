// Donnees scrapees depuis ffgolf.org et des-balles-et-des-birdies.com
//
// par_total est calcule depuis la somme des pars individuels (ffgolf publie
// parfois le par "double" pour les 9 trous, ce qui n'est pas ce qu'on veut).
//
// `slope` et `sss` au niveau course = repere championship messieurs (Noir/Blanc).
//   Conserve pour compat retro : utilise comme fallback quand un joueur n'a
//   pas de tee_color choisi.
//
// `tees` = liste des couples (sex, color, slope, sss) disponibles par parcours.
//   Pour les parcours 9 trous, les valeurs sont en mode 9-trous brut.
//   Quand le joueur active loop_twice (jouer le 9T deux fois), le serveur
//   double slope/SSS via getEffectiveCourse().
//
// Parcours sans donnees par tee disponibles publiquement (Goelands, Fabregues,
// Ecureuil, Fontcaude Executive) : meme valeur fallback sur tous les tees, en
// attente de donnees verifiees. Voir data-courses.md pour les `?` a completer.

const db = require('./db');

const COURSES = [
  // === 18 TROUS ===
  {
    name: "Massane (Montpellier)",
    city: "Baillargues",
    holes_count: 18,
    slope: 135, sss: 74.7,
    tees: [
      { sex: 'M', color: 'blanc', slope: 136, sss: 73.6 },
      { sex: 'M', color: 'jaune', slope: 128, sss: 71.0 },
      { sex: 'M', color: 'bleu',  slope: 128, sss: 68.2 },
      { sex: 'M', color: 'rouge', slope: 120, sss: 66.9 },
      { sex: 'F', color: 'jaune', slope: 136, sss: 77.0 },
      { sex: 'F', color: 'bleu',  slope: 128, sss: 73.8 },
      { sex: 'F', color: 'rouge', slope: 125, sss: 72.1 }
    ],
    holes: [
      { num: 1,  par: 4, si: 11 }, { num: 2,  par: 5, si: 4  }, { num: 3,  par: 3, si: 18 },
      { num: 4,  par: 4, si: 7  }, { num: 5,  par: 5, si: 8  }, { num: 6,  par: 4, si: 10 },
      { num: 7,  par: 4, si: 13 }, { num: 8,  par: 3, si: 14 }, { num: 9,  par: 5, si: 5  },
      { num: 10, par: 4, si: 6  }, { num: 11, par: 3, si: 9  }, { num: 12, par: 4, si: 12 },
      { num: 13, par: 4, si: 16 }, { num: 14, par: 5, si: 1  }, { num: 15, par: 3, si: 15 },
      { num: 16, par: 4, si: 3  }, { num: 17, par: 4, si: 17 }, { num: 18, par: 4, si: 2  }
    ]
  },
  {
    name: "La Grande Motte - Flamants Roses",
    city: "La Grande-Motte",
    holes_count: 18,
    slope: 133, sss: 72.7,
    tees: [
      { sex: 'M', color: 'blanc', slope: 133, sss: 72.7 },
      { sex: 'M', color: 'jaune', slope: 124, sss: 70.6 },
      { sex: 'M', color: 'bleu',  slope: 120, sss: 68.5 },
      { sex: 'M', color: 'rouge', slope: 115, sss: 66.3 },
      { sex: 'F', color: 'jaune', slope: 139, sss: 76.8 },
      { sex: 'F', color: 'bleu',  slope: 133, sss: 74.2 },
      { sex: 'F', color: 'rouge', slope: 121, sss: 72.3 }
    ],
    holes: [
      { num: 1,  par: 4, si: 7  }, { num: 2,  par: 4, si: 13 }, { num: 3,  par: 5, si: 11 },
      { num: 4,  par: 4, si: 9  }, { num: 5,  par: 3, si: 15 }, { num: 6,  par: 4, si: 3  },
      { num: 7,  par: 5, si: 1  }, { num: 8,  par: 3, si: 17 }, { num: 9,  par: 4, si: 5  },
      { num: 10, par: 5, si: 18 }, { num: 11, par: 4, si: 2  }, { num: 12, par: 4, si: 6  },
      { num: 13, par: 3, si: 16 }, { num: 14, par: 4, si: 4  }, { num: 15, par: 4, si: 8  },
      { num: 16, par: 3, si: 12 }, { num: 17, par: 5, si: 14 }, { num: 18, par: 4, si: 10 }
    ]
  },
  {
    name: "La Grande Motte - Les Goelands",
    city: "La Grande-Motte",
    holes_count: 18,
    slope: 90, sss: 54.2,
    // Donnees par tee non publiees publiquement : meme valeur sur tous les tees
    // en attente de donnees verifiees (cf. data-courses.md).
    tees: [
      { sex: 'M', color: 'blanc', slope: 90, sss: 54.2 },
      { sex: 'M', color: 'jaune', slope: 90, sss: 54.2 },
      { sex: 'M', color: 'bleu',  slope: 90, sss: 54.2 },
      { sex: 'M', color: 'rouge', slope: 90, sss: 54.2 },
      { sex: 'F', color: 'jaune', slope: 90, sss: 54.2 },
      { sex: 'F', color: 'bleu',  slope: 90, sss: 54.2 },
      { sex: 'F', color: 'rouge', slope: 90, sss: 54.2 }
    ],
    holes: [
      { num: 1,  par: 3, si: 8  }, { num: 2,  par: 3, si: 10 }, { num: 3,  par: 4, si: 3  },
      { num: 4,  par: 3, si: 7  }, { num: 5,  par: 3, si: 17 }, { num: 6,  par: 3, si: 14 },
      { num: 7,  par: 4, si: 9  }, { num: 8,  par: 3, si: 6  }, { num: 9,  par: 3, si: 13 },
      { num: 10, par: 3, si: 12 }, { num: 11, par: 4, si: 1  }, { num: 12, par: 3, si: 15 },
      { num: 13, par: 3, si: 5  }, { num: 14, par: 3, si: 18 }, { num: 15, par: 3, si: 4  },
      { num: 16, par: 3, si: 16 }, { num: 17, par: 3, si: 11 }, { num: 18, par: 4, si: 2  }
    ]
  },
  {
    name: "Cap d'Agde - Champion",
    city: "Cap d'Agde",
    holes_count: 18,
    slope: 139, sss: 73.3,
    tees: [
      { sex: 'M', color: 'blanc', slope: 143, sss: 74.3 },
      { sex: 'M', color: 'jaune', slope: 132, sss: 72.4 },
      { sex: 'M', color: 'bleu',  slope: 128, sss: 70.4 },
      { sex: 'M', color: 'rouge', slope: 123, sss: 68.2 },
      { sex: 'F', color: 'jaune', slope: 148, sss: 78.0 },
      { sex: 'F', color: 'bleu',  slope: 144, sss: 76.3 },
      { sex: 'F', color: 'rouge', slope: 130, sss: 74.0 }
    ],
    holes: [
      { num: 1,  par: 4, si: 5  }, { num: 2,  par: 4, si: 6  }, { num: 3,  par: 4, si: 11 },
      { num: 4,  par: 4, si: 16 }, { num: 5,  par: 5, si: 18 }, { num: 6,  par: 3, si: 10 },
      { num: 7,  par: 4, si: 3  }, { num: 8,  par: 3, si: 17 }, { num: 9,  par: 5, si: 12 },
      { num: 10, par: 4, si: 9  }, { num: 11, par: 5, si: 2  }, { num: 12, par: 4, si: 14 },
      { num: 13, par: 3, si: 13 }, { num: 14, par: 4, si: 8  }, { num: 15, par: 4, si: 7  },
      { num: 16, par: 3, si: 15 }, { num: 17, par: 5, si: 1  }, { num: 18, par: 4, si: 4  }
    ]
  },
  {
    name: "Fontcaude (Montpellier) - International",
    city: "Juvignac",
    holes_count: 18,
    slope: 144, sss: 73.4,
    tees: [
      { sex: 'M', color: 'blanc', slope: 144, sss: 73.4 },
      { sex: 'M', color: 'jaune', slope: 132, sss: 70.2 },
      { sex: 'M', color: 'bleu',  slope: 127, sss: 68.2 },
      { sex: 'M', color: 'rouge', slope: 123, sss: 65.9 },
      { sex: 'F', color: 'jaune', slope: 136, sss: 76.0 },
      { sex: 'F', color: 'bleu',  slope: 132, sss: 73.8 },
      { sex: 'F', color: 'rouge', slope: 128, sss: 70.4 }
    ],
    holes: [
      { num: 1,  par: 4, si: 17 }, { num: 2,  par: 3, si: 12 }, { num: 3,  par: 4, si: 3  },
      { num: 4,  par: 4, si: 15 }, { num: 5,  par: 5, si: 8  }, { num: 6,  par: 3, si: 6  },
      { num: 7,  par: 4, si: 7  }, { num: 8,  par: 4, si: 4  }, { num: 9,  par: 5, si: 16 },
      { num: 10, par: 4, si: 18 }, { num: 11, par: 4, si: 11 }, { num: 12, par: 3, si: 10 },
      { num: 13, par: 4, si: 2  }, { num: 14, par: 5, si: 14 }, { num: 15, par: 4, si: 1  },
      { num: 16, par: 4, si: 13 }, { num: 17, par: 3, si: 9  }, { num: 18, par: 5, si: 5  }
    ]
  },
  {
    name: "Beziers Saint-Thomas",
    city: "Beziers",
    holes_count: 18,
    slope: 140, sss: 73.1,
    tees: [
      { sex: 'M', color: 'blanc', slope: 140, sss: 73.1 },
      { sex: 'M', color: 'jaune', slope: 135, sss: 70.6 },
      { sex: 'M', color: 'bleu',  slope: 128, sss: 67.2 },
      { sex: 'M', color: 'rouge', slope: 126, sss: 66.0 },
      { sex: 'F', color: 'jaune', slope: 141, sss: 76.3 },
      { sex: 'F', color: 'bleu',  slope: 132, sss: 72.2 },
      { sex: 'F', color: 'rouge', slope: 128, sss: 71.3 }
    ],
    holes: [
      { num: 1,  par: 5, si: 11 }, { num: 2,  par: 4, si: 13 }, { num: 3,  par: 3, si: 17 },
      { num: 4,  par: 4, si: 15 }, { num: 5,  par: 4, si: 9  }, { num: 6,  par: 3, si: 3  },
      { num: 7,  par: 4, si: 1  }, { num: 8,  par: 4, si: 5  }, { num: 9,  par: 5, si: 7  },
      { num: 10, par: 4, si: 10 }, { num: 11, par: 4, si: 4  }, { num: 12, par: 4, si: 18 },
      { num: 13, par: 3, si: 6  }, { num: 14, par: 5, si: 16 }, { num: 15, par: 4, si: 12 },
      { num: 16, par: 3, si: 8  }, { num: 17, par: 4, si: 2  }, { num: 18, par: 5, si: 14 }
    ]
  },
  {
    name: "Pic Saint-Loup - Le Puech",
    city: "Saint-Mathieu-de-Treviers",
    holes_count: 18,
    slope: 150, sss: 70.6,
    tees: [
      { sex: 'M', color: 'blanc', slope: 150, sss: 70.6 },
      { sex: 'M', color: 'jaune', slope: 133, sss: 67.4 },
      { sex: 'M', color: 'bleu',  slope: 129, sss: 66.5 },
      { sex: 'M', color: 'rouge', slope: 125, sss: 64.4 },
      { sex: 'F', color: 'blanc', slope: 151, sss: 76.8 },
      { sex: 'F', color: 'jaune', slope: 145, sss: 74.1 },
      { sex: 'F', color: 'bleu',  slope: 140, sss: 70.7 },
      { sex: 'F', color: 'rouge', slope: 126, sss: 68.2 }
    ],
    holes: [
      { num: 1,  par: 4, si: 6  }, { num: 2,  par: 3, si: 8  }, { num: 3,  par: 4, si: 14 },
      { num: 4,  par: 4, si: 12 }, { num: 5,  par: 4, si: 10 }, { num: 6,  par: 3, si: 4  },
      { num: 7,  par: 4, si: 2  }, { num: 8,  par: 4, si: 16 }, { num: 9,  par: 5, si: 18 },
      { num: 10, par: 4, si: 5  }, { num: 11, par: 3, si: 17 }, { num: 12, par: 4, si: 9  },
      { num: 13, par: 3, si: 13 }, { num: 14, par: 5, si: 11 }, { num: 15, par: 4, si: 1  },
      { num: 16, par: 4, si: 3  }, { num: 17, par: 3, si: 15 }, { num: 18, par: 4, si: 7  }
    ]
  },

  // === 9 TROUS ===
  // Pour les 9 trous, slope/sss sont en mode 9-trous brut. Le serveur double
  // automatiquement quand loop_twice est active (cf. getEffectiveCourse).
  {
    name: "Fabregues Compact",
    city: "Fabregues",
    holes_count: 9,
    slope: 37, sss: 27.5, // fallback course-level (~ Rouge en mode 9T brut)
    // Re-calibration officielle 2026-03-19 : slope 73 / SSS 55 sur 18T => /2 pour stockage 9T.
    // "Rouge" = reperes standards (H et F sur le compact).
    // "P&P" = Pitch & Putt, reperes courts pour F compact ou prise d'index (H et F).
    tees: [
      { sex: 'M', color: 'rouge', slope: 36.5, sss: 27.5 },
      { sex: 'M', color: 'pp',    slope: 36.5, sss: 27.0 },
      { sex: 'F', color: 'rouge', slope: 36.5, sss: 27.5 },
      { sex: 'F', color: 'pp',    slope: 36.5, sss: 27.0 }
    ],
    holes: [
      { num: 1, par: 3, si: 6 }, { num: 2, par: 3, si: 2 }, { num: 3, par: 3, si: 3 },
      { num: 4, par: 3, si: 5 }, { num: 5, par: 3, si: 4 }, { num: 6, par: 3, si: 9 },
      { num: 7, par: 3, si: 1 }, { num: 8, par: 3, si: 7 }, { num: 9, par: 3, si: 8 }
    ]
  },
  {
    name: "Lamalou-les-Bains",
    city: "Lamalou-les-Bains",
    holes_count: 9,
    slope: 66, sss: 33.8,
    // Valeurs DBDB sont en 18T (jouer 2 fois) : on les divise par 2 pour le mode 9T brut.
    // Le serveur double automatiquement si loop_twice est active.
    tees: [
      { sex: 'M', color: 'blanc', slope: 66, sss: 33.8 },
      { sex: 'M', color: 'jaune', slope: 60, sss: 33.2 },
      { sex: 'M', color: 'bleu',  slope: 58, sss: 32.1 },
      { sex: 'M', color: 'rouge', slope: 56, sss: 31.1 },
      { sex: 'F', color: 'blanc', slope: 69, sss: 36.3 },
      { sex: 'F', color: 'jaune', slope: 68, sss: 35.4 },
      { sex: 'F', color: 'bleu',  slope: 65, sss: 34.0 },
      { sex: 'F', color: 'rouge', slope: 59, sss: 32.9 }
    ],
    holes: [
      { num: 1, par: 4, si: 2 }, { num: 2, par: 4, si: 9 }, { num: 3, par: 3, si: 5 },
      { num: 4, par: 5, si: 1 }, { num: 5, par: 4, si: 4 }, { num: 6, par: 3, si: 6 },
      { num: 7, par: 4, si: 8 }, { num: 8, par: 4, si: 7 }, { num: 9, par: 4, si: 3 }
    ]
  },
  {
    name: "Coulondres (Pic Saint-Loup)",
    city: "Saint-Gely-du-Fesc",
    holes_count: 9,
    slope: 73, sss: 38.6, // fallback ~ Blanc M en 9T (= 146/2 / 77.1/2)
    // Valeurs officielles publiees en 18T (le 9T se joue 2 fois) : on /2 pour stockage 9T brut.
    // Le serveur double automatiquement via loop_twice (cf. getEffectiveCourse).
    tees: [
      { sex: 'M', color: 'blanc', slope: 73,   sss: 38.6 },
      { sex: 'M', color: 'jaune', slope: 70,   sss: 37.8 },
      { sex: 'M', color: 'bleu',  slope: 68,   sss: 36.9 },
      { sex: 'M', color: 'rouge', slope: 66.5, sss: 36.0 },
      { sex: 'F', color: 'jaune', slope: 77,   sss: 40.5 },
      { sex: 'F', color: 'bleu',  slope: 74.5, sss: 39.4 },
      { sex: 'F', color: 'rouge', slope: 69.5, sss: 38.7 }
    ],
    holes: [
      { num: 1, par: 4, si: 1 }, { num: 2, par: 5, si: 9 }, { num: 3, par: 3, si: 4 },
      { num: 4, par: 5, si: 2 }, { num: 5, par: 4, si: 3 }, { num: 6, par: 3, si: 6 },
      { num: 7, par: 5, si: 5 }, { num: 8, par: 3, si: 8 }, { num: 9, par: 5, si: 7 }
    ]
  },
  {
    name: "Massane - L'Ecureuil (compact)",
    city: "Baillargues",
    holes_count: 9,
    slope: 40, sss: 24,
    // Donnees par tee non publiees : meme valeur fallback sur tous les tees.
    tees: [
      { sex: 'M', color: 'jaune', slope: 40, sss: 24 },
      { sex: 'M', color: 'bleu',  slope: 40, sss: 24 },
      { sex: 'F', color: 'jaune', slope: 40, sss: 24 },
      { sex: 'F', color: 'rouge', slope: 40, sss: 24 }
    ],
    holes: [
      { num: 1, par: 3, si: 2 }, { num: 2, par: 3, si: 3 }, { num: 3, par: 3, si: 7 },
      { num: 4, par: 3, si: 5 }, { num: 5, par: 3, si: 8 }, { num: 6, par: 3, si: 1 },
      { num: 7, par: 3, si: 4 }, { num: 8, par: 3, si: 9 }, { num: 9, par: 3, si: 6 }
    ]
  },
  {
    name: "Fontcaude - Executive",
    city: "Juvignac",
    holes_count: 9,
    slope: 40, sss: 25,
    // Donnees par tee non publiees : meme valeur fallback sur tous les tees.
    tees: [
      { sex: 'M', color: 'jaune', slope: 40, sss: 25 },
      { sex: 'M', color: 'bleu',  slope: 40, sss: 25 },
      { sex: 'F', color: 'jaune', slope: 40, sss: 25 },
      { sex: 'F', color: 'rouge', slope: 40, sss: 25 }
    ],
    holes: [
      { num: 1, par: 3, si: 9 }, { num: 2, par: 3, si: 8 }, { num: 3, par: 3, si: 7 },
      { num: 4, par: 4, si: 6 }, { num: 5, par: 3, si: 3 }, { num: 6, par: 3, si: 2 },
      { num: 7, par: 3, si: 4 }, { num: 8, par: 3, si: 5 }, { num: 9, par: 3, si: 1 }
    ]
  }
];

function seed() {
  const upsert = db.prepare(`
    INSERT INTO courses (name, city, par_total, slope, sss, holes_json, tees_json)
    VALUES (@name, @city, @par_total, @slope, @sss, @holes_json, @tees_json)
    ON CONFLICT(name) DO UPDATE SET
      city = excluded.city,
      par_total = excluded.par_total,
      slope = excluded.slope,
      sss = excluded.sss,
      holes_json = excluded.holes_json,
      tees_json = excluded.tees_json
  `);
  const tx = db.transaction((rows) => {
    for (const c of rows) {
      const par_total = c.holes.reduce((s, h) => s + h.par, 0);
      upsert.run({
        name: c.name,
        city: c.city,
        par_total,
        slope: c.slope,
        sss: c.sss,
        holes_json: JSON.stringify(c.holes),
        tees_json: JSON.stringify(c.tees || [])
      });
    }
  });
  tx(COURSES);
  console.log(`Seeded ${COURSES.length} parcours de l'Herault.`);
  for (const c of COURSES) {
    const par_total = c.holes.reduce((s, h) => s + h.par, 0);
    const teeCount = (c.tees || []).length;
    console.log(`  - ${c.name} (${c.holes_count} trous, par ${par_total}, ${teeCount} tees)`);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, COURSES };
