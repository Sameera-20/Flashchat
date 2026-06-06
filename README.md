# FlashChat — 1-on-1 Chat App Migration Guide

## What Changed

The app has been redesigned from a **group room chat** to a **1-on-1 WhatsApp-style chat** with:

- ✅ Direct message conversations between users
- ✅ Online / Offline status indicators  
- ✅ Typing indicators (real-time)
- ✅ Read receipts (✓ sent → ✓✓ delivered → ✓✓ seen in blue)
- ✅ Emoji picker + emoji reactions (hover a message to react)
- ✅ File & media sharing (images, videos, PDFs, documents up to 25MB)
- ✅ Image lightbox (click to expand)
- ✅ Dark / Light mode toggle
- ✅ Responsive — works on mobile and desktop
- ✅ Toast notifications for new messages from other conversations

---

## Files to Replace / Add

### Client (`src/`)

| File | Action |
|------|--------|
| `src/App.css` | **Replace** entirely |
| `src/App.js` | **Replace** entirely |
| `src/pages/ChatPage.jsx` | **Replace** (was room-based) |
| `src/components/Sidebar.jsx` | **Replace** (now shows DM list) |
| `src/components/ChatWindow.jsx` | **Replace** (1-on-1, file upload) |
| `src/components/MessageBubble.jsx` | **Replace** (file/image/video bubbles) |
| `src/components/RightPanel.jsx` | **Replace** (partner profile) |
| `src/components/Toast.jsx` | **New file** |
| `src/context/SocketContext.jsx` | **Replace** (conversation events) |

### Server (`/`)

| File | Action |
|------|--------|
| `socket.js` | **Replace** (conversation-based events) |
| `models/Message.js` | **Replace** (adds file fields, conversation ref) |
| `models/Conversation.js` | **New model** |
| `routes/conversations.js` | **New route** |
| `routes/messages.js` | **New route** (replaces rooms-based messages) |
| `routes/users.js` | **New route** (user search) |
| `server.js` | **Update** — see the server.js file for lines to add |

---

## Install New Dependencies

```bash
# Server
npm install multer

# Client — already using socket.io-client, axios, react-router-dom, date-fns
# No new client dependencies needed
```

---

## Database Migration

The app now uses `Conversation` documents instead of `Room` documents. Your existing `Room` and group `Message` data will not be affected — the new collections are `conversations` and the updated `messages` collection. You can safely leave old data in place.

---

## Environment Variables

No changes needed to your existing `.env`. Optionally add:

```
REACT_APP_SERVER_URL=http://localhost:5000   # in client .env
```

---

## How It Works

1. User logs in → lands on chat page
2. Click **+** in sidebar → search for any registered user by name/email
3. Click a user → creates (or opens) a 1-on-1 conversation
4. Chat in real-time with typing indicators and read receipts
5. Click 📎 to attach images, videos, or files
6. Hover any message → emoji reaction bar appears
7. Click ℹ️ header button → opens right panel with contact info and dark mode toggle