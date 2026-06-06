const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // your existing JWT middleware
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');

// GET /api/conversations — list all DMs for current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'username email avatar status lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type fileName createdAt sender read'
      })
      .sort({ updatedAt: -1 });

    // Shape the response with partner info
    const shaped = conversations.map(conv => {
      const partner = conv.participants.find(p => p._id.toString() !== req.user._id.toString());
      return {
        _id: conv._id,
        participants: conv.participants,
        partner,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
        unread: conv.unreadCounts?.get(req.user._id.toString()) || 0
      };
    });

    res.json({ conversations: shaped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/conversations — start or get a DM with another user
router.post('/', auth, async (req, res) => {
  try {
    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ message: 'partnerId required' });
    if (partnerId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    const partner = await User.findById(partnerId).select('username email avatar status');
    if (!partner) return res.status(404).json({ message: 'User not found' });

    // Find existing conversation (order-independent)
    let conv = await Conversation.findOne({
      participants: { $all: [req.user._id, partnerId], $size: 2 }
    }).populate('participants', 'username email avatar status lastSeen');

    if (!conv) {
      conv = await Conversation.create({
        participants: [req.user._id, partnerId]
      });
      conv = await Conversation.findById(conv._id)
        .populate('participants', 'username email avatar status lastSeen');
    }

    res.json({ conversation: conv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;