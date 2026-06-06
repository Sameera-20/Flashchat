const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// userId -> socketId
const onlineUsers = new Map();

module.exports = (io) => {
  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`✅ Connected: ${user.username} (${socket.id})`);

    // Mark online
    onlineUsers.set(user._id.toString(), socket.id);
    await User.findByIdAndUpdate(user._id, { status: 'online' });
    io.emit('users:online', Array.from(onlineUsers.keys()));

    // ─── JOIN CONVERSATION ──────────────────────────────
    socket.on('conversation:join', async ({ conversationId }) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv) return socket.emit('error', 'Conversation not found');
        // Check participant
        if (!conv.participants.map(String).includes(user._id.toString())) {
          return socket.emit('error', 'Not a participant');
        }
        socket.join(conversationId);
        console.log(`${user.username} joined conversation ${conversationId}`);
      } catch (err) {
        socket.emit('error', 'Could not join conversation');
      }
    });

    // ─── LEAVE CONVERSATION ─────────────────────────────
    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(conversationId);
    });

    // ─── TYPING ─────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(conversationId).emit('typing:update', {
        userId: user._id, username: user.username, isTyping: true
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(conversationId).emit('typing:update', {
        userId: user._id, username: user.username, isTyping: false
      });
    });

    // ─── MESSAGE REACTION ────────────────────────────────
    socket.on('message:react', async ({ messageId, emoji, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const ri = message.reactions.findIndex(r => r.emoji === emoji);
        if (ri === -1) {
          message.reactions.push({ emoji, users: [user._id] });
        } else {
          const ui = message.reactions[ri].users.map(String).indexOf(user._id.toString());
          if (ui === -1) {
            message.reactions[ri].users.push(user._id);
          } else {
            message.reactions[ri].users.splice(ui, 1);
            if (message.reactions[ri].users.length === 0) {
              message.reactions.splice(ri, 1);
            }
          }
        }
        await message.save();
        io.to(conversationId).emit('message:reacted', {
          messageId, reactions: message.reactions
        });
      } catch (err) {
        socket.emit('error', 'Could not react');
      }
    });

    // ─── READ RECEIPT ────────────────────────────────────
    socket.on('message:read', async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { readBy: user._id },
          read: true
        });
        socket.to(conversationId).emit('message:read', { messageId, userId: user._id });
      } catch {}
    });

    // ─── DISCONNECT ──────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Disconnected: ${user.username}`);
      onlineUsers.delete(user._id.toString());
      await User.findByIdAndUpdate(user._id, { status: 'offline', lastSeen: new Date() });
      io.emit('users:online', Array.from(onlineUsers.keys()));
    });
  });
};