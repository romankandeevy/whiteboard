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
// roomCode → Map<socketId, { name, color }>
const roomUsers = new Map();

function getRoomUsersList(code) {
  const m = roomUsers.get(code);
  if (!m) return [];
  return [...m.entries()].map(([id, u]) => ({ id, name: u.name, color: u.color }));
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ code, name, color }) => {
    currentRoom = code.toUpperCase();
    if (!roomUsers.has(currentRoom)) roomUsers.set(currentRoom, new Map());
    roomUsers.get(currentRoom).set(socket.id, { name: name || 'Гость', color: color || '#888' });

    socket.join(currentRoom);
    io.to(currentRoom).emit('room-users', getRoomUsersList(currentRoom));
  });

  socket.on('stroke', (stroke) => {
    if (currentRoom) socket.to(currentRoom).emit('stroke', stroke);
  });

  socket.on('delete-strokes', (ids) => {
    if (currentRoom) socket.to(currentRoom).emit('delete-strokes', ids);
  });

  socket.on('clear', () => {
    if (currentRoom) socket.to(currentRoom).emit('clear');
  });

  socket.on('cursor', ({ x, y }) => {
    if (currentRoom) socket.to(currentRoom).emit('cursor', { id: socket.id, x, y });
  });

  socket.on('cursor-leave', () => {
    if (currentRoom) socket.to(currentRoom).emit('cursor-leave', { id: socket.id });
  });

  socket.on('disconnect', () => {
    if (currentRoom && roomUsers.has(currentRoom)) {
      roomUsers.get(currentRoom).delete(socket.id);
      socket.to(currentRoom).emit('cursor-leave', { id: socket.id });
      if (roomUsers.get(currentRoom).size === 0) {
        roomUsers.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('room-users', getRoomUsersList(currentRoom));
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
