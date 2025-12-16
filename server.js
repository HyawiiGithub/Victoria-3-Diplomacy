// Server-side: Express + SQLite + bcrypt + cookie-session
const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieSession = require('cookie-session');

const app = express();
const db = new sqlite3.Database('data.sqlite');

app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'dev-secret'],
  maxAge: 7 * 24 * 60 * 60 * 1000
}));
app.use(express.static('.')); // serve index.html, style.css, script.js at root

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    title TEXT,
    role TEXT DEFAULT NULL CHECK (role IN ('great','major','minor','protectorate'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS treaties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    limitations TEXT,
    createdBy TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treatyId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('follow','decline')),
    UNIQUE(treatyId, userId),
    FOREIGN KEY (treatyId) REFERENCES treaties(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`);
});

// Helpers
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userRole || req.session.userRole !== 'great') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
function publicUser(u) {
  return { id: u.id, username: u.username, title: u.title, role: u.role };
}

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, password, title } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 12);
    db.run(
      `INSERT INTO users (username, passwordHash, title) VALUES (?,?,?)`,
      [username, hash, title || null],
      function (err) {
        if (err) {
          if (String(err).includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
          return res.status(500).json({ error: 'DB error' });
        }
        return res.json({ ok: true });
      }
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username=?`, [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.json({ user: publicUser(user) });
  });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  db.get(`SELECT * FROM users WHERE id=?`, [req.session.userId], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: publicUser(user) });
  });
});

// Treaties
app.post('/api/treaties', requireAuth, (req, res) => {
  const { name, category, limitations } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Missing fields' });
  db.get(`SELECT username FROM users WHERE id=?`, [req.session.userId], (err, me) => {
    if (err || !me) return res.status(500).json({ error: 'DB error' });
    db.run(
      `INSERT INTO treaties (name, category, limitations, createdBy, createdAt)
       VALUES (?,?,?,?,?)`,
      [name, category, limitations || null, me.username, Date.now()],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json({ id: this.lastID });
      }
    );
  });
});

app.get('/api/treaties', (req, res) => {
  const limit = Number(req.query.limit) || null;
  const base = `SELECT * FROM treaties ORDER BY createdAt DESC`;
  const sql = limit ? `${base} LIMIT ?` : base;
  const params = limit ? [limit] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ treaties: rows });
  });
});

// Agreements (follow/decline)
app.post('/api/agreements/:treatyId', requireAuth, (req, res) => {
  const treatyId = Number(req.params.treatyId);
  const { decision } = req.body;
  if (!['follow', 'decline'].includes(decision)) return res.status(400).json({ error: 'Bad decision' });
  db.run(
    `INSERT INTO agreements (treatyId, userId, decision)
     VALUES (?,?,?)
     ON CONFLICT(treatyId, userId) DO UPDATE SET decision=excluded.decision`,
    [treatyId, req.session.userId, decision],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true });
    }
  );
});

app.get('/api/agreements/mine', requireAuth, (req, res) => {
  db.get(`SELECT COUNT(*) AS count FROM agreements WHERE userId=? AND decision='follow'`, [req.session.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ count: row.count });
  });
});

// Admin
app.post('/api/admin/role', requireAuth, requireAdmin, (req, res) => {
  const { username, role } = req.body;
  if (!['great','major','minor','protectorate'].includes(role)) return res.status(400).json({ error: 'Bad role' });
  db.run(`UPDATE users SET role=? WHERE username=?`, [role, username], function (err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  db.all(`SELECT id, username, title, role FROM users ORDER BY username ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ users: rows });
  });
});

// Bootstrap: create a default admin if absent
db.get(`SELECT * FROM users WHERE username='admin'`, async (err, row) => {
  if (!row) {
    const hash = await bcrypt.hash('admin', 12);
    db.run(`INSERT INTO users (username, passwordHash, title, role) VALUES (?,?,?,?)`,
      ['admin', hash, 'Global Secretariat', 'great']);
    console.log('Seeded admin account: admin/admin');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
