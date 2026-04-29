const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'golf.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    city TEXT,
    par_total INTEGER NOT NULL,
    slope INTEGER NOT NULL,
    sss REAL NOT NULL,
    holes_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    formula TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'setup',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sex TEXT NOT NULL CHECK(sex IN ('M', 'F')),
    handicap REAL NOT NULL,
    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    hole_num INTEGER NOT NULL,
    strokes INTEGER NOT NULL,
    UNIQUE(player_id, hole_num),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
  );
`);

// Migrations idempotentes : ajout des colonnes ajoutees apres v1
const cols = db.prepare("PRAGMA table_info(games)").all().map(c => c.name);
if (!cols.includes('code'))       db.exec("ALTER TABLE games ADD COLUMN code TEXT");
if (!cols.includes('loop_twice')) db.exec("ALTER TABLE games ADD COLUMN loop_twice INTEGER NOT NULL DEFAULT 0");
if (!cols.includes('closed_at'))  db.exec("ALTER TABLE games ADD COLUMN closed_at TEXT");

const playerCols = db.prepare("PRAGMA table_info(players)").all().map(c => c.name);
if (!playerCols.includes('position')) {
  db.exec("ALTER TABLE players ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE players SET position = id WHERE position = 0");
}
if (!playerCols.includes('tee_color')) {
  db.exec("ALTER TABLE players ADD COLUMN tee_color TEXT");
}

const courseCols = db.prepare("PRAGMA table_info(courses)").all().map(c => c.name);
if (!courseCols.includes('tees_json')) {
  db.exec("ALTER TABLE courses ADD COLUMN tees_json TEXT");
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);

module.exports = db;
