const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);

// Список досок
router.get('/', (req, res) => {
  const boards = db.prepare('SELECT id, title, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json(boards);
});

// Создать доску
router.post('/', (req, res) => {
  const id = crypto.randomUUID();
  const title = req.body.title || 'Untitled';
  db.prepare('INSERT INTO boards (id, user_id, title) VALUES (?, ?, ?)').run(id, req.user.id, title);
  res.json({ id, title });
});

// Получить доску
router.get('/:id', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ...board, data: JSON.parse(board.data) });
});

// Сохранить доску
router.put('/:id', (req, res) => {
  const board = db.prepare('SELECT id FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Не найдено' });

  const { title, data } = req.body;
  db.prepare('UPDATE boards SET title = COALESCE(?, title), data = COALESCE(?, data), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title ?? null, data !== undefined ? JSON.stringify(data) : null, req.params.id);
  res.json({ ok: true });
});

// Удалить доску
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM boards WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Открыть комнату
router.post('/:id/room/open', (req, res) => {
  const board = db.prepare('SELECT id, room_code FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Не найдено' });
  if (board.room_code) return res.json({ code: board.room_code });

  let code;
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits  = '123456789';
  do {
    code = [0,1,2].map(i => letters[Math.floor(Math.random()*letters.length)] + digits[Math.floor(Math.random()*digits.length)]).join('');
  } while (db.prepare('SELECT id FROM boards WHERE room_code = ?').get(code));

  db.prepare('UPDATE boards SET room_code = ? WHERE id = ?').run(code, req.params.id);
  res.json({ code });
});

// Закрыть комнату
router.post('/:id/room/close', (req, res) => {
  const board = db.prepare('SELECT id FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Не найдено' });
  db.prepare('UPDATE boards SET room_code = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Найти доску по коду комнаты (публично)
router.get('/room/:code', (req, res) => {
  const board = db.prepare('SELECT id, title, data FROM boards WHERE room_code = ?').get(req.params.code.toUpperCase());
  if (!board) return res.status(404).json({ error: 'Комната не найдена' });
  res.json({ ...board, data: JSON.parse(board.data) });
});

module.exports = router;
