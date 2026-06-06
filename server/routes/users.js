const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// GET /api/users/search?q=username
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ users: [] });

    const users = await User.find({
      _id: { $ne: req.user._id }, // exclude self
      $or: [
        { username: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } }
      ]
    })
      .select('username email avatar status lastSeen')
      .limit(10);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;