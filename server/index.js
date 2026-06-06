require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations'); // new
const messageRoutes = require('./routes/messages');           // new
const userRoutes = require('./routes/users');                 // new
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible inside route handlers (needed for file upload emit)
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve uploaded files as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes); // new
app.use('/api/messages', messageRoutes);           // new
app.use('/api/users', userRoutes);                 // new

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

// Socket.IO
setupSocket(io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:');
    console.error(err);
    process.exit(1);
  });