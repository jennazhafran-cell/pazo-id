require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Multer untuk Upload Gambar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_jangan_dipakai_di_production',
  resave: false,
  saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Auth Admin
function authMiddleware(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// Helper Slug
function createSlug(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// --- ROUTE USER ---

// Halaman Utama & Pencarian
app.get('/', (req, res) => {
  const search = req.query.q || '';
  let query = `SELECT * FROM articles WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC`;
  
  db.all(query, [`%${search}%`, `%${search}%`], (err, articles) => {
    if (err) return res.status(500).send('Database Error');
    res.render('index', { articles, search });
  });
});

// Detail Artikel
app.get('/analisis/:slug', (req, res) => {
  const slug = req.params.slug;
  db.get(`SELECT * FROM articles WHERE slug = ?`, [slug], (err, article) => {
    if (err || !article) return res.status(404).send('Artikel tidak ditemukan');

    // Ambil artikel berikutnya untuk rekomendasi
    db.all(`SELECT * FROM articles WHERE id != ? ORDER BY created_at DESC LIMIT 3`, [article.id], (err, nextArticles) => {
      res.render('detail', { article, nextArticles });
    });
  });
});

// SEO: Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: http://${req.headers.host}/sitemap.xml`);
});

// SEO: Sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  db.all(`SELECT slug, created_at FROM articles ORDER BY created_at DESC`, [], (err, articles) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>http://${req.headers.host}/</loc><priority>1.0</priority></url>\n`;
    articles.forEach(art => {
      xml += `  <url><loc>http://${req.headers.host}/analisis/${art.slug}</loc><priority>0.8</priority></url>\n`;
    });
    xml += `</urlset>`;
    res.type('application/xml');
    res.send(xml);
  });
});

// --- ROUTE ADMIN ---

app.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.isAdmin = true;
      res.redirect('/admin');
    } else {
      res.render('login', { error: 'Username atau Password salah!' });
    }
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard Admin
app.get('/admin', authMiddleware, (req, res) => {
  db.all(`SELECT * FROM articles ORDER BY created_at DESC`, [], (err, articles) => {
    res.render('admin', { articles });
  });
});

// Form Tambah Artikel
app.get('/admin/tambah', authMiddleware, (req, res) => {
  res.render('editor', { article: null });
});

// Process Simpan Artikel Baru
app.post('/admin/tambah', authMiddleware, upload.single('thumbnail'), (req, res) => {
  const { title, content, entry, take_profit, stop_loss } = req.body;
  const slug = createSlug(title) + '-' + Date.now();
  const thumbnail = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.jpg';

  db.run(
    `INSERT INTO articles (title, slug, thumbnail, content, entry, take_profit, stop_loss) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, thumbnail, content, entry, take_profit, stop_loss],
    (err) => {
      if (err) console.error(err);
      res.redirect('/admin');
    }
  );
});

// Form Edit Artikel
app.get('/admin/edit/:id', authMiddleware, (req, res) => {
  db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id], (err, article) => {
    if (!article) return res.redirect('/admin');
    res.render('editor', { article });
  });
});

// Process Update Artikel
app.post('/admin/edit/:id', authMiddleware, upload.single('thumbnail'), (req, res) => {
  const { title, content, entry, take_profit, stop_loss } = req.body;
  const id = req.params.id;

  if (req.file) {
    const thumbnail = `/uploads/${req.file.filename}`;
    db.run(
      `UPDATE articles SET title = ?, thumbnail = ?, content = ?, entry = ?, take_profit = ?, stop_loss = ? WHERE id = ?`,
      [title, thumbnail, content, entry, take_profit, stop_loss, id],
      () => res.redirect('/admin')
    );
  } else {
    db.run(
      `UPDATE articles SET title = ?, content = ?, entry = ?, take_profit = ?, stop_loss = ? WHERE id = ?`,
      [title, content, entry, take_profit, stop_loss, id],
      () => res.redirect('/admin')
    );
  }
});

// Process Hapus Artikel
app.get('/admin/hapus/:id', authMiddleware, (req, res) => {
  db.run(`DELETE FROM articles WHERE id = ?`, [req.params.id], () => {
    res.redirect('/admin');
  });
});

app.listen(PORT, () => {
  console.log(`Server PAZO.id berjalan di http://localhost:${PORT}`);
});
