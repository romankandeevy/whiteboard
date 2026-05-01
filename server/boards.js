const express = require('express');
const pool = require('./db');
const { requireAuth } = require('./auth');
const { randomUUID } = require('crypto');

const router = express.Router();

// Найти доску по коду комнаты (публично)
router.get('/room/:code', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, data FROM boards WHERE room_code = $1', [req.params.code.toUpperCase()]);
    if (!result.rows.length) return res.status(404).json({ error: 'Комната не найдена' });
    const board = result.rows[0];
    res.json({ ...board, data: JSON.parse(board.data) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.use(requireAuth);

// Список досок
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, created_at, updated_at FROM boards WHERE user_id = $1 ORDER BY updated_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать доску
router.post('/', async (req, res) => {
  try {
    const id = randomUUID();
    const title = req.body.title || 'Untitled';
    await pool.query('INSERT INTO boards (id, user_id, title) VALUES ($1, $2, $3)', [id, req.user.id, title]);
    res.json({ id, title });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить доску
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM boards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Не найдено' });
    const board = result.rows[0];
    res.json({ ...board, data: JSON.parse(board.data) });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить доску
router.put('/:id', async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM boards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Не найдено' });
    const { title, data } = req.body;
    await pool.query(
      'UPDATE boards SET title = COALESCE($1, title), data = COALESCE($2, data), updated_at = NOW() WHERE id = $3',
      [title ?? null, data !== undefined ? JSON.stringify(data) : null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить доску
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM boards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Открыть комнату
router.post('/:id/room/open', async (req, res) => {
  try {
    const check = await pool.query('SELECT id, room_code FROM boards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Не найдено' });
    if (check.rows[0].room_code) return res.json({ code: check.rows[0].room_code });

    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits  = '123456789';
    let code, exists;
    do {
      code = [0,1,2].map(() => letters[Math.floor(Math.random()*letters.length)] + digits[Math.floor(Math.random()*digits.length)]).join('');
      exists = await pool.query('SELECT id FROM boards WHERE room_code = $1', [code]);
    } while (exists.rows.length);

    await pool.query('UPDATE boards SET room_code = $1 WHERE id = $2', [code, req.params.id]);
    res.json({ code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Закрыть комнату
router.post('/:id/room/close', async (req, res) => {
  try {
    await pool.query('UPDATE boards SET room_code = NULL WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
