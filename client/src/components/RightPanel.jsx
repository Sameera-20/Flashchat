import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

const COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626'];
const getColor = (name) => {
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

export default function RightPanel({ conv, theme, onToggleTheme, onClose, onLogout, sharedMedia = [] }) {
  const { isUserOnline } = useSocket();
  const [lightbox, setLightbox] = useState(null);

  if (!conv) return null;

  const isOnline = isUserOnline(conv.partnerId);

  return (
    <aside className="right-panel">
      {/* Header */}
      <div className="right-panel-header">
        <h4>Contact Info</h4>
        <button className="icon-btn" onClick={onClose} title="Close">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Profile card */}
      <div className="profile-card">
        <div
          className="profile-avatar-lg"
          style={{ background: getColor(conv.partnerName) }}
        >
          {conv.partnerAvatar
            ? <img src={conv.partnerAvatar} alt={conv.partnerName} />
            : (conv.partnerName || '?')[0].toUpperCase()
          }
        </div>
        <div className="profile-name">{conv.partnerName}</div>
        {conv.partnerEmail && (
          <div className="profile-email">{conv.partnerEmail}</div>
        )}
        <div className={`profile-status-badge ${isOnline ? 'online' : 'offline'}`}>
          <span style={{ fontSize: '.55rem' }}>●</span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Shared Media */}
      <div className="panel-section">
        <div className="panel-section-title">
          Shared Media
          {sharedMedia.length > 0 && (
            <span style={{
              marginLeft: 6,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: '.65rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 'var(--radius-full)',
            }}>
              {sharedMedia.length}
            </span>
          )}
        </div>

        {sharedMedia.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '1.25rem .5rem',
            color: 'var(--text-muted)',
            fontSize: '.8rem',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🖼️</div>
            Photos and files you share will appear here
          </div>
        ) : (
          <div className="media-grid">
            {sharedMedia.slice(0, 9).map((url, i) => (
              <div
                key={i}
                className="media-thumb"
                onClick={() => setLightbox(url)}
                title="Click to view"
              >
                <img src={url} alt={`shared-${i}`} />
              </div>
            ))}
            {sharedMedia.length > 9 && (
              <div className="media-thumb" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-hover)',
                fontSize: '.8rem', fontWeight: 700,
                color: 'var(--text-secondary)', cursor: 'default',
              }}>
                +{sharedMedia.length - 9}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="panel-section">
        <div className="panel-section-title">Settings</div>
        <div className="toggle-row">
          <span>{theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={onToggleTheme}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* About */}
      <div className="panel-section">
        <div className="panel-section-title">About</div>
        <p style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          🔒 End-to-end encrypted. Only you and {conv.partnerName} can read your messages.
        </p>
      </div>

      {/* Logout */}
      <div style={{ marginTop: 'auto', padding: '1rem' }}>
        <button className="logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>

      {/* Lightbox for media preview */}
      {lightbox && (
        <div
          className="lightbox"
          onClick={() => setLightbox(null)}
          style={{ zIndex: 500 }}
        >
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="preview" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </aside>
  );
}