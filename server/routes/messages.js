const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Multer Setup ────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    // Allow images, videos, documents, archives
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|pdf|doc|docx|xls|xlsx|txt|zip|rar|mp3|wav/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('File type not supported'));
  }
});

const getFileType = (mimetype = '', originalname = '') => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'file';
};

// ─── GET /api/messages/:conversationId ──────────────────────────────────────
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

    // Verify participant
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = { conversation: conversationId };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .populate('sender', 'username avatar status')
      .sort({ createdAt: 1 })
      .limit(Number(limit));

    // Mark all as read
    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: req.user._id }, read: false },
      { $set: { read: true }, $addToSet: { readBy: req.user._id } }
    );

    // Reset unread count for this user
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCounts.${req.user._id}`]: 0 }
    });

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/messages — send a text message ────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content required' });

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const message = await Message.create({
      content: content.trim(),
      sender: req.user._id,
      conversation: conversationId,
      type: 'text',
      readBy: [req.user._id]
    });

    const populated = await message.populate('sender', 'username avatar status');

    // Update conversation
    const partnerId = conv.participants.find(p => p.toString() !== req.user._id.toString());
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
      $inc: { [`unreadCounts.${partnerId}`]: 1 }
    });

    // Emit via socket (so the sender gets it back too — for multi-device)
    const io = req.app.get('io');
    if (io) io.to(conversationId).emit('message:receive', { ...populated.toJSON(), conversationId });

    res.json({ message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/messages/upload — send a file/image ──────────────────────────
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { conversationId } = req.body;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = getFileType(req.file.mimetype, req.file.originalname);

    const message = await Message.create({
      content: '',
      sender: req.user._id,
      conversation: conversationId,
      type: fileType,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      readBy: [req.user._id]
    });

    const populated = await message.populate('sender', 'username avatar status');

    const partnerId = conv.participants.find(p => p.toString() !== req.user._id.toString());
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
      $inc: { [`unreadCounts.${partnerId}`]: 1 }
    });

    const io = req.app.get('io');
    if (io) io.to(conversationId).emit('message:receive', { ...populated.toJSON(), conversationId });

    res.json({ message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PATCH /api/messages/:messageId — edit a text message ───────────────────
router.patch('/:messageId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content required' });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Only sender can edit
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your message' });
    }

    // Only text messages can be edited
    if (message.type !== 'text') {
      return res.status(400).json({ message: 'Only text messages can be edited' });
    }

    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    // Broadcast to conversation
    const io = req.app.get('io');
    if (io) {
      io.to(message.conversation.toString()).emit('message:edited', {
        messageId: message._id,
        content: message.content,
      });
    }

    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/messages/:messageId — delete a message ─────────────────────
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your message' });
    }

    // Soft delete — keep the record but mark as deleted
    message.deleted = true;
    message.deletedAt = new Date();
    message.content = '';
    await message.save();

    // Broadcast to conversation
    const io = req.app.get('io');
    if (io) {
      io.to(message.conversation.toString()).emit('message:deleted', {
        messageId: message._id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;