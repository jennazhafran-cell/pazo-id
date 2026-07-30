const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'pazo.db'), (err) => {
  if (err) {
    console.error('Gagal terhubung ke database:', err.message);
  } else {
    console.log('Terhubung ke database SQLite.');
  }
});

db.serialize(() => {
  // Tabel Artikel
  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    thumbnail TEXT,
    content TEXT NOT NULL,
    entry TEXT,
    take_profit TEXT,
    stop_loss TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabel Admin
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`, () => {
    // Tambah admin default jika belum ada
    db.get(`SELECT * FROM users WHERE username = ?`, ['admin'], async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hashedPassword]);
        console.log('Admin default berhasil dibuat (User: admin, Pass: admin123)');
      }
    });
  });
});

module.exports = db;