const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { router: authRouter } = require('./auth');
const boardsRouter = require('./boards');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);

app.use(express.static(path.join(__dirname, '..')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Socket.io rooms ──────────────────────────────────────────────────────────
// roomCode → Set of socket ids
const roomUsers = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', ({ code, user }) => {
    currentRoom = code.toUpperCase();
    currentUser = user || 'Гость';

    if (!roomUsers.has(currentRoom)) roomUsers.set(currentRoom, new Map());
    roomUsers.get(currentRoom).set(socket.id, currentUser);

    socket.join(currentRoom);
    io.to(currentRoom).emit('room-users', [...roomUsers.get(currentRoom).values()]);
  });

  socket.on('stroke', (stroke) => {
    if (currentRoom) socket.to(currentRoom).emit('stroke', stroke);
  });

  socket.on('strokes-update', (strokes) => {
    if (currentRoom) socket.to(currentRoom).emit('strokes-update', strokes);
  });

  socket.on('clear', () => {
    if (currentRoom) socket.to(currentRoom).emit('clear');
  });

  socket.on('disconnect', () => {
    if (currentRoom && roomUsers.has(currentRoom)) {
      roomUsers.get(currentRoom).delete(socket.id);
      if (roomUsers.get(currentRoom).size === 0) {
        roomUsers.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('room-users', [...roomUsers.get(currentRoom).values()]);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
