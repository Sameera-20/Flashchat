// ─────────────────────────────────────────────────────────────────────────────
// server.js  — Add/update these lines in your existing Express server
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible from route handlers
app.set('io', io);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// ─── Serve uploaded files ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));          // keep existing
app.use('/api/users',         require('./routes/users'));         // NEW: user search
app.use('/api/conversations', require('./routes/conversations')); // NEW: DM conversations
app.use('/api/messages',      require('./routes/messages'));      // UPDATED: DM messages

// ─── Socket ──────────────────────────────────────────────────────────────────
require('./socket')(io);

// ─── DB + Start ───────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => { console.error('MongoDB error:', err); process.exit(1); });

// ─── Also install multer if not already ─────────────────────────────────────
// npm install multer