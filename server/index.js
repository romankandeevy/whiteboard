const express = require('express');
const cors = require('cors');
const path = require('path');
const Pusher = require('pusher');
const { router: authRouter } = require('./auth');
const boardsRouter = require('./boards');

const app = express();
const PORT = process.env.PORT || 3000;

const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID   || '2149274',
  key:     process.env.PUSHER_KEY      || '23028e580390fb730357',
  secret:  process.env.PUSHER_SECRET   || '138b7afcde463babba9b',
  cluster: process.env.PUSHER_CLUSTER  || 'eu',
  useTLS: true,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);

// ── Pusher event relay ────────────────────────────────────────────────────────
// Клиент шлёт событие сюда, мы бродкастим в канал (исключая отправителя)
app.post('/api/room/event', async (req, res) => {
  const { channel, event, data, socketId } = req.body;
  if (!channel || !event) return res.status(400).json({ error: 'bad request' });
  try {
    await pusher.trigger(channel, event, data, { socket_id: socketId });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'pusher error' });
  }
});

// Pusher auth для presence-каналов
app.post('/api/pusher/auth', (req, res) => {
  const { socket_id, channel_name, username, color } = req.body;
  const userData = {
    user_id: socket_id,
    user_info: { name: username || 'Гость', color: color || '#888' },
  };
  const auth = pusher.authorizeChannel(socket_id, channel_name, userData);
  res.json(auth);
});

app.use(express.static(path.join(__dirname, '..')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
