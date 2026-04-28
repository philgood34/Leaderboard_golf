// Donnees scrapees depuis ffgolf.org (calculette officielle)
// Source : https://www.ffgolf.org/parcours-detours/guide-des-golfs/occitanie/herault
//
// par_total est calcule depuis la somme des pars individuels (ffgolf publie
// parfois le par "double" pour les 9 trous, ce qui n'est pas ce qu'on veut).
// slope/sss : valeurs publiees par ffgolf pour le repere principal messieurs.
//   - Sur les parcours 9 trous, ces valeurs sont propres au format 9 trous.

const db = require('./db');

const COURSES = [
  // === 18 TROUS ===
  {
    name: "Massane (Montpellier)",
    city: "Baillargues",
    holes_count: 18,
    slope: 135, sss: 74.7,
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
  {
    name: "Fabregues Compact",
    city: "Fabregues",
    holes_count: 9,
    slope: 37, sss: 27.5,
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
    holes: [
      { num: 1, par: 4, si: 2 }, { num: 2, par: 4, si: 9 }, { num: 3, par: 3, si: 5 },
      { num: 4, par: 5, si: 1 }, { num: 5, par: 4, si: 4 }, { num: 6, par: 3, si: 6 },
      { num: 7, par: 4, si: 8 }, { num: 8, par: 4, si: 7 }, { num: 9, par: 4, si: 3 }
    ]
  },
  {
    name: "Massane - L'Ecureuil (compact)",
    city: "Baillargues",
    holes_count: 9,
    slope: 40, sss: 24,
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
    holes: [
      { num: 1, par: 3, si: 9 }, { num: 2, par: 3, si: 8 }, { num: 3, par: 3, si: 7 },
      { num: 4, par: 4, si: 6 }, { num: 5, par: 3, si: 3 }, { num: 6, par: 3, si: 2 },
      { num: 7, par: 3, si: 4 }, { num: 8, par: 3, si: 5 }, { num: 9, par: 3, si: 1 }
    ]
  }
];

function seed() {
  const upsert = db.prepare(`
    INSERT INTO courses (name, city, par_total, slope, sss, holes_json)
    VALUES (@name, @city, @par_total, @slope, @sss, @holes_json)
    ON CONFLICT(name) DO UPDATE SET
      city = excluded.city,
      par_total = excluded.par_total,
      slope = excluded.slope,
      sss = excluded.sss,
      holes_json = excluded.holes_json
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
        holes_json: JSON.stringify(c.holes)
      });
    }
  });
  tx(COURSES);
  console.log(`Seeded ${COURSES.length} parcours de l'Herault.`);
  for (const c of COURSES) {
    const par_total = c.holes.reduce((s, h) => s + h.par, 0);
    console.log(`  - ${c.name} (${c.holes_count} trous, par ${par_total}, slope ${c.slope}, SSS ${c.sss})`);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, COURSES };
