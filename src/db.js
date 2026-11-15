'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS internships(
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL, category TEXT NOT NULL,
      location TEXT NOT NULL, type TEXT NOT NULL, stipend INTEGER NOT NULL, description TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS applications(
      id INTEGER PRIMARY KEY AUTOINCREMENT, internship_id INTEGER NOT NULL REFERENCES internships(id),
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, resume_url TEXT, cover_letter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(internship_id, email));
  `);
  const count = db.prepare('SELECT COUNT(*) AS c FROM internships').get().c;
  if (count === 0) {
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'internships.json'), 'utf8'));
    const ins = db.prepare('INSERT INTO internships(id,title,company,category,location,type,stipend,description) VALUES(?,?,?,?,?,?,?,?)');
    for (const r of rows) ins.run(r.id, r.title, r.company, r.category, r.location, r.type, r.stipend, r.description);
  }
  return db;
}
module.exports = { openDb };
