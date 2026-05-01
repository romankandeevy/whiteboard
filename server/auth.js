const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'wb-secret-dev-key-change-in-prod';

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

// Регистрация
router.post('/register', (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Email уже используется' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)').run(email.toLowerCase(), name, hash);
  const user = { id: result.lastInsertRowid, email: email.toLowerCase(), name };

  // Создаём первую доску
  const boardId = crypto.randomUUID();
  db.prepare('INSERT INTO boards (id, user_id, title) VALUES (?, ?, ?)').run(boardId, user.id, 'My first board');

  res.json({ token: makeToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

// Вход
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Заполните все поля' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  res.json({ token: makeToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

// Проверка токена
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Не авторизован' });
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

module.exports = { router, requireAuth };
