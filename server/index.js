const express = require('express');
const cors = require('cors');
const path = require('path');
const { router: authRouter } = require('./auth');
const boardsRouter = require('./boards');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API
app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);

// Фронтенд — отдаём статику
app.use(express.static(path.join(__dirname, '..')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
