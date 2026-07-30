const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'pazo.db'));

async function updateAdmin() {
  const newUsername = '@zhafranmm';
  const newPassword = 'Darkflame24';

  // Hash password baru
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Hapus akun lama & masukkan akun baru
  db.serialize(() => {
    db.run(`DELETE FROM users`);
    db.run(
      `INSERT INTO users (username, password) VALUES (?, ?)`,
      [newUsername, hashedPassword],
      (err) => {
        if (err) {
          console.error('Gagal memperbarui admin:', err.message);
        } else {
          console.log('✅ Berhasil memperbarui Akun Admin!');
          console.log(`Username baru: ${newUsername}`);
          console.log(`Password baru: ${newPassword}`);
        }
      }
    );
  });
}

updateAdmin();