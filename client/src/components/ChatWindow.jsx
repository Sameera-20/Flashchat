import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import MessageBubble, { DateDivider } from './MessageBubble';

const QUICK_EMOJIS = ['😊','😂','❤️','👍','🎉','😮','😢','🔥','✅','👏','🙏','😍'];

const groupMessages = (messages) => {
  const groups = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    const showDate = !prev ||
      new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
    const showAvatar = !prev || prev.sender?._id !== msg.sender?._id ||
      showDate || (new Date(msg.createdAt) - new Date(prev.createdAt)) > 300000;
    groups.push({ msg, showDate, showAvatar });
  });
  return groups;
};

const COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626'];
const getColor = (name) => {
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

function Avatar({ name, avatar, size = 40, online }) {
  return (
    <div className="avatar" style={{ width: size, height: size, flexShrink: 0 }}>
      <div className="avatar-img" style={{
        width: size, height: size, fontSize: size * 0.38,
        background: getColor(name), borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 600, overflow: 'hidden'
      }}>
        {avatar
          ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (name || '?')[0].toUpperCase()
        }
      </div>
      {online !== undefined && <span className={`status-dot ${online ? 'online' : 'offline'}`} />}
    </div>
  );
}

export default function ChatWindow({ conv, currentUser, onBack, onInfoClick, onMediaUpdate }) {
  const { socket, isUserOnline } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingPartner, setTypingPartner] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTyping = useRef(false);
  const pendingTemps = useRef(new Set());

  // Helper: consistent ID comparison (handles ObjectId vs string)
  const sameId = (a, b) => a?.toString() === b?.toString();

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Extract media from messages and notify parent (RightPanel)
  const updateSharedMedia = useCallback((msgs) => {
    if (!onMediaUpdate) return;
    const media = msgs
      .filter(m => m.type === 'image' && (m.fileUrl || m.localUrl))
      .map(m => m.fileUrl || m.localUrl);
    onMediaUpdate(media);
  }, [onMediaUpdate]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conv) { setMessages([]); return; }
    setLoading(true);
    setMessages([]);
    setTypingPartner(false);
    pendingTemps.current.clear();

    axios.get(`/api/messages/${conv._id}`)
      .then(res => {
        const msgs = res.data.messages || [];
        setMessages(msgs);
        updateSharedMedia(msgs);
        setTimeout(() => scrollToBottom('instant'), 50);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (socket) socket.emit('conversation:join', { conversationId: conv._id });

    return () => {
      if (socket) socket.emit('conversation:leave', { conversationId: conv._id });
    };
  }, [conv?._id, socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !conv) return;

    const onMsg = (msg) => {
      const msgConvId = msg.conversationId || msg.conversation;
      // Compare as strings to handle ObjectId vs string mismatch
      if (msgConvId?.toString() !== conv._id?.toString()) return;

      setMessages(prev => {
        // 1. True duplicate — already have this real ID
        if (prev.find(m => m._id === msg._id)) return prev;

        // 2. Echo of OUR own sent message — replace the matching temp bubble
        if (sameId(msg.sender?._id, currentUser._id) && pendingTemps.current.size > 0) {
          const tempIds = [...pendingTemps.current];
          const tempId = tempIds[0];
          const tempIndex = prev.findIndex(m => m._id === tempId);
          if (tempIndex !== -1) {
            pendingTemps.current.delete(tempId);
            const updated = [...prev];
            updated[tempIndex] = { ...msg, status: 'sent' };
            // Update shared media
            updateSharedMedia(updated);
            return updated;
          }
        }

        // 3. Message from partner — append
        const next = [...prev, msg];
        updateSharedMedia(next);
        return next;
      });

      // Mark as read only if message is from partner
      if (!sameId(msg.sender?._id, currentUser._id)) {
        socket.emit('message:read', { messageId: msg._id, conversationId: conv._id });
      }

      setTimeout(scrollToBottom, 60);
    };

    const onTyping = ({ userId, isTyping: typing }) => {
      if (sameId(userId, conv.partnerId)) setTypingPartner(typing);
    };

    const onReacted = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    };

    const onRead = ({ messageId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, read: true } : m));
    };

    const onEdited = ({ messageId, content }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, content, edited: true } : m
      ));
    };

    const onDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, deleted: true } : m
      ));
    };

    socket.on('message:receive', onMsg);
    socket.on('typing:update', onTyping);
    socket.on('message:reacted', onReacted);
    socket.on('message:read', onRead);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);

    return () => {
      socket.off('message:receive', onMsg);
      socket.off('typing:update', onTyping);
      socket.off('message:reacted', onReacted);
      socket.off('message:read', onRead);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
    };
  }, [socket, conv, currentUser._id]);

  const sendTyping = useCallback((typing) => {
    if (!socket || !conv) return;
    if (typing && !isTyping.current) {
      isTyping.current = true;
      socket.emit('typing:start', { conversationId: conv._id });
    }
    clearTimeout(typingTimeout.current);
    if (typing) {
      typingTimeout.current = setTimeout(() => {
        isTyping.current = false;
        socket.emit('typing:stop', { conversationId: conv._id });
      }, 2000);
    } else {
      isTyping.current = false;
      socket.emit('typing:stop', { conversationId: conv._id });
    }
  }, [socket, conv]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !conv) return;
    setInput('');
    sendTyping(false);
    setShowEmoji(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const optimistic = {
      _id: tempId,
      content: text,
      type: 'text',
      sender: { _id: currentUser._id, username: currentUser.username },
      conversationId: conv._id,
      createdAt: new Date().toISOString(),
      status: 'sending',
      reactions: []
    };

    pendingTemps.current.add(tempId);
    setMessages(prev => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await axios.post('/api/messages', { conversationId: conv._id, content: text });
      const saved = res.data.message;
      setMessages(prev => {
        const idx = prev.findIndex(m => m._id === tempId);
        if (idx !== -1) {
          pendingTemps.current.delete(tempId);
          const updated = [...prev];
          updated[idx] = { ...saved, status: 'sent' };
          return updated;
        }
        return prev.map(m => m._id === saved._id ? { ...m, status: 'sent' } : m);
      });
    } catch {
      pendingTemps.current.delete(tempId);
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
    }
  }, [input, conv, currentUser, sendTyping, scrollToBottom]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    sendTyping(!!e.target.value);
  };

  const addEmoji = (emoji) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !conv) return;
    e.target.value = '';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conv._id);

    const tempId = 'temp_file_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const localUrl = URL.createObjectURL(file);

    const optimistic = {
      _id: tempId,
      content: '',
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
      fileName: file.name,
      fileSize: file.size,
      sender: { _id: currentUser._id, username: currentUser.username },
      conversationId: conv._id,
      createdAt: new Date().toISOString(),
      status: 'sending',
      reactions: [],
      localUrl
    };

    pendingTemps.current.add(tempId);
    setMessages(prev => {
      const next = [...prev, optimistic];
      if (isImage) updateSharedMedia(next);
      return next;
    });
    setTimeout(scrollToBottom, 50);

    try {
      const res = await axios.post('/api/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const saved = res.data.message;
      setMessages(prev => {
        const idx = prev.findIndex(m => m._id === tempId);
        if (idx !== -1) {
          pendingTemps.current.delete(tempId);
          const updated = [...prev];
          updated[idx] = { ...saved, status: 'sent' };
          updateSharedMedia(updated);
          return updated;
        }
        return prev.map(m => m._id === saved._id ? { ...m, status: 'sent' } : m);
      });
    } catch {
      pendingTemps.current.delete(tempId);
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  const handleReact = useCallback((messageId, emoji) => {
    if (!socket || !conv) return;
    socket.emit('message:react', { messageId, emoji, conversationId: conv._id });
  }, [socket, conv]);

  const handleEdit = useCallback(async (messageId, newContent) => {
    if (!newContent?.trim()) return;
    // Optimistic update
    setMessages(prev => prev.map(m =>
      m._id === messageId
        ? { ...m, content: newContent.trim(), edited: true }
        : m
    ));
    try {
      await axios.patch(`/api/messages/${messageId}`, { content: newContent.trim() });
    } catch {
      // Revert on failure — reload messages
      const res = await axios.get(`/api/messages/${conv._id}`);
      setMessages(res.data.messages || []);
    }
  }, [conv]);

  const handleDelete = useCallback(async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    // Optimistic update — show deleted placeholder
    setMessages(prev => prev.map(m =>
      m._id === messageId ? { ...m, deleted: true } : m
    ));
    try {
      await axios.delete(`/api/messages/${messageId}`);
    } catch {
      // Revert on failure
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, deleted: false } : m
      ));
    }
  }, []);

  // ── No conversation selected ─────────────────────────────────────────────
  if (!conv) {
    return (
      <div className="chat-window">
        <div className="chat-empty flex-center" style={{ flex: 1, height: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="chat-empty-icon">💬</div>
            <h3>Your Messages</h3>
            <p>Send private messages to people you know. Click <strong>+</strong> in the sidebar to start a new conversation.</p>
          </div>
        </div>
      </div>
    );
  }

  const isOnline = isUserOnline(conv.partnerId);
  const grouped = groupMessages(messages);

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left" onClick={onInfoClick} style={{ cursor: 'pointer' }}>
          {/* Mobile back button */}
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onBack?.(); }}
            style={{ display: 'none' }}
            id="back-btn"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Avatar name={conv.partnerName} avatar={conv.partnerAvatar} size={38} online={isOnline} />
          <div>
            <div className="chat-header-name">{conv.partnerName}</div>
            <div className={`chat-header-status ${typingPartner ? 'typing' : isOnline ? 'online' : 'offline'}`}>
              {typingPartner ? 'typing…' : isOnline ? '● Online' : '○ Offline'}
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" onClick={onInfoClick} title="Contact info">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 16v-4M12 8h.01" strokeWidth="2.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="messages-area">
        {loading ? (
          <div className="flex-center" style={{ flex: 1 }}>
            <div className="spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty flex-center" style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Avatar name={conv.partnerName} avatar={conv.partnerAvatar} size={64} />
              <strong style={{ marginTop: 6 }}>{conv.partnerName}</strong>
              <p style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>
                Say hello! This is the beginning of your conversation.
              </p>
            </div>
          </div>
        ) : (
          grouped.map(({ msg, showDate, showAvatar }, idx) => (
            <React.Fragment key={msg._id || idx}>
              {showDate && <DateDivider date={msg.createdAt} />}
              <MessageBubble
                message={msg}
                isMine={sameId(msg.sender?._id, currentUser._id)}
                showAvatar={showAvatar}
                onReact={handleReact}
                onImageClick={setLightbox}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </React.Fragment>
          ))
        )}

        {/* Typing indicator */}
        {typingPartner && (
          <div className="msg-group in" style={{ marginTop: 4 }}>
            <div className="msg-row in">
              <Avatar name={conv.partnerName} avatar={conv.partnerAvatar} size={26} />
              <div className="typing-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Emoji picker */}
        {showEmoji && (
          <div className="emoji-picker-container">
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '.5rem',
              display: 'flex', flexWrap: 'wrap', gap: 4, width: 268,
              boxShadow: 'var(--shadow-lg)',
            }}>
              {QUICK_EMOJIS.map(e => (
                <button key={e} className="emoji-btn" onClick={() => addEmoji(e)} style={{ fontSize: '1.3rem' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-input-bar">
          {/* File attachment */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={handleFileSelect}
          />
          <button
            className="emoji-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}
          >
            📎
          </button>

          {/* Text input */}
          <div className="input-wrap">
            <button
              className="emoji-btn"
              onClick={() => setShowEmoji(p => !p)}
              title="Emoji"
              style={{ opacity: showEmoji ? 1 : 0.7, color: 'var(--text-secondary)' }}
            >
              😊
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${conv.partnerName}…`}
              rows={1}
              style={{ lineHeight: '1.5', paddingTop: '1px' }}
              maxLength={2000}
            />
          </div>

          {/* Send button */}
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send (Enter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="full" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}