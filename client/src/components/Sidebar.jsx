import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api';   // adjust path based on file location
import { useSocket } from '../context/SocketContext';

const COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626'];
const getColor = (name) => {
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

function Avatar({ name, avatar, size = 40, online }) {
  return (
    <div className="avatar" style={{ width: size, height: size, flexShrink: 0 }}>
      <div
        className="avatar-img"
        style={{
          width: size, height: size,
          fontSize: size * 0.38,
          background: getColor(name),
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 600, overflow: 'hidden',
        }}
      >
        {avatar
          ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (name || '?')[0].toUpperCase()
        }
      </div>
      {online !== undefined && (
        <span className={`status-dot ${online ? 'online' : 'offline'}`} />
      )}
    </div>
  );
}

// Map server conversation object to the shape the app uses
const mapConversation = (conv, myId) => {
  // Partner is the participant who is NOT the current user
  const partner = conv.partner ||
    conv.participants?.find(p => p._id?.toString() !== myId?.toString()) ||
    {};
  return {
    _id: conv._id,
    partnerId: partner._id,
    partnerName: partner.username || 'Unknown',
    partnerEmail: partner.email || '',
    partnerAvatar: partner.avatar || '',
    partnerStatus: partner.status || 'offline',
    lastMessage: conv.lastMessage,
    updatedAt: conv.updatedAt,
    unread: conv.unread || 0,
  };
};

const formatTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function Sidebar({
  activeConv, onSelectConv, currentUser,
  onLogout, theme, onToggleTheme, mobileSidebarOpen
}) {
  const { isUserOnline, socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);

  // Load conversations on mount
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConvs(true);
      const res = await axios.get('/api/conversations');
      const mapped = (res.data.conversations || []).map(c =>
        mapConversation(c, currentUser._id)
      );
      setConversations(mapped);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoadingConvs(false);
    }
  }, [currentUser._id]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Listen for new incoming messages to bump conv to top + update preview
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      const msgConvId = (msg.conversationId || msg.conversation)?.toString();
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id?.toString() === msgConvId);
        if (idx === -1) {
          // Unknown conversation — reload list
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const conv = { ...updated[idx] };
        conv.lastMessage = msg;
        conv.updatedAt = msg.createdAt;
        // Increment unread if it's not the active conversation
        if (activeConv?._id?.toString() !== msgConvId &&
            msg.sender?._id?.toString() !== currentUser._id?.toString()) {
          conv.unread = (conv.unread || 0) + 1;
        }
        updated.splice(idx, 1);
        return [conv, ...updated]; // bump to top
      });
    };
    socket.on('message:receive', handler);
    return () => socket.off('message:receive', handler);
  }, [socket, activeConv, currentUser._id, loadConversations]);

  // Clear unread when a conversation is selected
  const handleSelect = (conv) => {
    setConversations(prev =>
      prev.map(c => c._id === conv._id ? { ...c, unread: 0 } : c)
    );
    onSelectConv(conv);
  };

  // Search users for new chat
  useEffect(() => {
    if (!showNewChat || !search.trim()) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`/api/users/search?q=${encodeURIComponent(search)}`);
        setUserResults(res.data.users || []);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, showNewChat]);

  // Start or open a DM with a user
  const startConversation = async (partner) => {
    try {
      const res = await axios.post('/api/conversations', { partnerId: partner._id });
      const mapped = mapConversation(res.data.conversation, currentUser._id);
      setConversations(prev => {
        const exists = prev.find(c => c._id === mapped._id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
      handleSelect(mapped);
      setSearch('');
      setUserResults([]);
      setShowNewChat(false);
    } catch (e) {
      console.error('Failed to start conversation', e);
    }
  };

  // Filter conversations by search when NOT in new-chat mode
  const filtered = showNewChat
    ? conversations
    : conversations.filter(c =>
        c.partnerName?.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <aside className={`sidebar ${mobileSidebarOpen === false ? 'mobile-hidden' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span>Messages</span>
        </div>
        <div className="sidebar-actions">
          <button
            className={`icon-btn ${showNewChat ? 'active' : ''}`}
            onClick={() => {
              setShowNewChat(p => !p);
              setSearch('');
              setUserResults([]);
            }}
            title="New chat"
          >
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="sidebar-search">
        <div className="search-wrap">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder={showNewChat ? 'Search users to chat…' : 'Search conversations…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {searching && <div className="spinner" style={{ width: 14, height: 14 }} />}
        </div>
      </div>

      {/* New chat user search results */}
      {showNewChat && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Section label */}
          <div style={{
            padding: '.5rem 1.125rem .25rem',
            fontSize: '.7rem', fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>
            {search.trim() ? 'Search Results' : 'Start a new chat'}
          </div>

          {!search.trim() && (
            <div style={{
              padding: '1rem 1.125rem',
              fontSize: '.85rem', color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              Type a name or email above to find someone to chat with.
            </div>
          )}

          {userResults.length === 0 && search.trim() && !searching && (
            <div style={{
              padding: '1rem 1.125rem',
              fontSize: '.85rem', color: 'var(--text-muted)',
            }}>
              No users found for "{search}"
            </div>
          )}

          {userResults.map(u => (
            <div
              key={u._id}
              className="conv-item"
              onClick={() => startConversation(u)}
            >
              <Avatar name={u.username} avatar={u.avatar} size={42} online={isUserOnline(u._id)} />
              <div className="conv-info">
                <div className="conv-top">
                  <span className="conv-name">{u.username}</span>
                  <span style={{
                    fontSize: '.7rem',
                    color: isUserOnline(u._id) ? 'var(--online)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}>
                    {isUserOnline(u._id) ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="conv-bottom">
                  <span className="conv-preview">{u.email}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation list */}
      {!showNewChat && (
        <div className="conv-list">
          {/* Section label */}
          <div style={{
            padding: '.5rem 1.125rem .25rem',
            fontSize: '.7rem', fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>
            Chats · {filtered.length}
          </div>

          {loadingConvs ? (
            <div className="flex-center" style={{ padding: '2rem' }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2rem 1rem',
              color: 'var(--text-muted)', fontSize: '.875rem', lineHeight: 1.7,
            }}>
              {search
                ? `No conversations matching "${search}"`
                : 'No conversations yet.\nClick + to start chatting!'
              }
            </div>
          ) : (
            filtered.map(conv => {
              const online = isUserOnline(conv.partnerId);
              const isActive = activeConv?._id === conv._id;
              const lastMsg = conv.lastMessage;
              let preview = 'Start a conversation';
              if (lastMsg) {
                if (lastMsg.type === 'image') preview = '📷 Photo';
                else if (lastMsg.type === 'video') preview = '🎥 Video';
                else if (lastMsg.type === 'file') preview = `📎 ${lastMsg.fileName || 'File'}`;
                else if (lastMsg.content) {
                  preview = lastMsg.content.slice(0, 45) +
                    (lastMsg.content.length > 45 ? '…' : '');
                }
              }

              return (
                <div
                  key={conv._id}
                  className={`conv-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(conv)}
                >
                  <Avatar
                    name={conv.partnerName}
                    avatar={conv.partnerAvatar}
                    size={44}
                    online={online}
                  />
                  <div className="conv-info">
                    <div className="conv-top">
                      <span className="conv-name">{conv.partnerName}</span>
                      <span className="conv-time">{formatTime(conv.updatedAt)}</span>
                    </div>
                    <div className="conv-bottom">
                      <span className="conv-preview">{preview}</span>
                      {conv.unread > 0 && (
                        <span className="unread-badge">{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer — current user info + theme toggle + logout */}
      <div className="sidebar-footer">
        <Avatar
          name={currentUser?.username}
          avatar={currentUser?.avatar}
          size={36}
          online={true}
        />
        <div className="sidebar-footer-info">
          <div className="sidebar-footer-name">{currentUser?.username}</div>
          <div className="sidebar-footer-sub">● Online</div>
        </div>
        <label className="toggle-switch" title="Toggle dark mode">
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={onToggleTheme}
          />
          <span className="toggle-slider" />
        </label>
        <button className="icon-btn" onClick={onLogout} title="Logout">
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}