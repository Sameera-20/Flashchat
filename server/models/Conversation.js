const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // unread counts per user: { userId: count }
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

// Index for fast participant lookup
conversationSchema.index({ participants: 1 });

// Prevent duplicate conversations between same two users
conversationSchema.index(
  { 'participants.0': 1, 'participants.1': 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);