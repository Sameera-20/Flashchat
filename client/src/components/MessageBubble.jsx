import React, { useState, useRef, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

const formatTime = (d) => format(new Date(d), 'h:mm a');

export const formatDateDivider = (d) => {
  const date = new Date(d);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

export const DateDivider = ({ date }) => (
  <div className="day-divider">
    <span>{formatDateDivider(date)}</span>
  </div>
);

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileIcon = (name = '') => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  if (['mp3', 'wav', 'm4a'].includes(ext)) return '🎵';
  return '📎';
};

function ReadTick({ status, read }) {
  if (read) return <span className="read-tick seen" title="Seen">✓✓</span>;
  if (status === 'sending') return <span className="read-tick sent" title="Sending">🕐</span>;
  if (status === 'failed') return <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>!</span>;
  return <span className="read-tick delivered" title="Delivered">✓</span>;
}

// ── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, isMine, isText, onReact, onEdit, onDelete, onClose }) {
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Adjust position so menu never goes off-screen
  const style = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: 160,
    overflow: 'hidden',
    animation: 'fadeUp .12s ease both',
  };

  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '.6rem 1rem',
    fontSize: '.875rem', fontWeight: 500,
    cursor: 'pointer', color: 'var(--text-primary)',
    transition: 'background .12s',
    border: 'none', background: 'none',
    width: '100%', textAlign: 'left',
    fontFamily: 'var(--font)',
  };

  return (
    <div ref={menuRef} style={style}>
      {/* Reaction row */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
      }}>
        {QUICK_REACTIONS.map(e => (
          <button
            key={e}
            onClick={() => { onReact(e); onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.1rem', padding: '3px 4px', borderRadius: '50%',
              transition: 'transform .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Edit — only for own text messages */}
      {isMine && isText && (
        <button
          style={itemStyle}
          onClick={() => { onEdit(); onClose(); }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span>✏️</span> Edit message
        </button>
      )}

      {/* Delete — only for own messages */}
      {isMine && (
        <button
          style={{ ...itemStyle, color: '#ef4444' }}
          onClick={() => { onDelete(); onClose(); }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span>🗑️</span> Delete message
        </button>
      )}

      {/* For received messages — only reactions available (already shown above) */}
      {!isMine && (
        <div style={{
          padding: '.4rem 1rem',
          fontSize: '.75rem', color: 'var(--text-muted)',
          fontStyle: 'italic',
        }}>
          React to this message
        </div>
      )}
    </div>
  );
}

// ── Edit Input ────────────────────────────────────────────────────────────────
function EditInput({ value, onSave, onCancel }) {
  const [text, setText] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Place cursor at end
    const len = text.length;
    inputRef.current?.setSelectionRange(len, len);
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onCancel();
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === value) { onCancel(); return; }
    onSave(trimmed);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, maxWidth: 320 }}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        rows={2}
        maxLength={2000}
        style={{
          padding: '.5rem .75rem',
          background: 'rgba(255,255,255,.15)',
          border: '1.5px solid rgba(255,255,255,.4)',
          borderRadius: 'var(--radius-sm)',
          color: 'inherit',
          fontSize: '.875rem',
          fontFamily: 'var(--font)',
          resize: 'none',
          outline: 'none',
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '.25rem .7rem', fontSize: '.78rem', fontWeight: 600,
            background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'inherit', cursor: 'pointer', fontFamily: 'var(--font)',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || text.trim() === value}
          style={{
            padding: '.25rem .7rem', fontSize: '.78rem', fontWeight: 600,
            background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#1d4ed8', cursor: 'pointer', fontFamily: 'var(--font)',
          }}
        >
          Save
        </button>
      </div>
      <div style={{ fontSize: '.68rem', opacity: .6 }}>Enter to save · Esc to cancel</div>
    </div>
  );
}

// ── Main MessageBubble ────────────────────────────────────────────────────────
export default function MessageBubble({
  message, isMine, showAvatar,
  onReact, onImageClick, onEdit, onDelete
}) {
  const [contextMenu, setContextMenu] = useState(null); // { x, y }
  const [editing, setEditing] = useState(false);

  const isImage = message.type === 'image';
  const isVideo = message.type === 'video';
  const isFile  = message.type === 'file';
  const isText  = !isImage && !isVideo && !isFile;
  const mediaUrl = message.fileUrl || message.localUrl;

  if (message.type === 'system') {
    return <div className="system-msg">{message.content}</div>;
  }

  // Show deleted message placeholder
  if (message.deleted) {
    return (
      <div className={`msg-group ${isMine ? 'out' : 'in'}`}>
        <div className={`msg-row ${isMine ? 'out' : 'in'}`}>
          {!isMine && <div style={{ width: 28, flexShrink: 0 }} />}
          <div className={`bubble ${isMine ? 'out' : 'in'}`} style={{ opacity: .55, fontStyle: 'italic' }}>
            <p style={{ margin: 0, fontSize: '.825rem' }}>🚫 This message was deleted</p>
            <div className="bubble-meta">
              <span>{formatTime(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRightClick = (e) => {
    e.preventDefault();
    // Adjust so menu doesn't overflow right/bottom edge
    const menuW = 180, menuH = 200;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 10);
    setContextMenu({ x, y });
  };

  const handleLongPress = (() => {
    let timer;
    return {
      onTouchStart: (e) => {
        timer = setTimeout(() => {
          const touch = e.touches[0];
          const menuW = 180, menuH = 200;
          const x = Math.min(touch.clientX, window.innerWidth - menuW - 10);
          const y = Math.min(touch.clientY, window.innerHeight - menuH - 10);
          setContextMenu({ x, y });
        }, 500);
      },
      onTouchEnd: () => clearTimeout(timer),
      onTouchMove: () => clearTimeout(timer),
    };
  })();

  return (
    <>
      <div
        className={`msg-group ${isMine ? 'out' : 'in'}`}
        onContextMenu={handleRightClick}
        {...handleLongPress}
      >
        <div className={`msg-row ${isMine ? 'out' : 'in'}`}>
          {/* Avatar for received messages */}
          {!isMine && (
            <div style={{ width: 28, flexShrink: 0, alignSelf: 'flex-end' }}>
              {showAvatar && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '.7rem', fontWeight: 600, overflow: 'hidden',
                }}>
                  {message.sender?.avatar
                    ? <img src={message.sender.avatar} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (message.sender?.username || '?')[0].toUpperCase()
                  }
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '0 1 auto' }}>
            <div style={{ position: 'relative' }}>

              {/* ── Image bubble ── */}
              {isImage && (
                <div className={`bubble bubble-media ${isMine ? 'out' : 'in'}`}>
                  <img
                    src={mediaUrl}
                    alt={message.fileName || 'image'}
                    onClick={() => onImageClick?.(mediaUrl)}
                    style={{ cursor: 'zoom-in' }}
                  />
                  <div className="bubble-meta">
                    <span>{formatTime(message.createdAt)}</span>
                    {isMine && <ReadTick status={message.status} read={message.read} />}
                  </div>
                </div>
              )}

              {/* ── Video bubble ── */}
              {isVideo && (
                <div className={`bubble bubble-media ${isMine ? 'out' : 'in'}`}>
                  <video controls src={mediaUrl}
                    style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, display: 'block' }} />
                  <div className="bubble-meta">
                    <span>{formatTime(message.createdAt)}</span>
                    {isMine && <ReadTick status={message.status} read={message.read} />}
                  </div>
                </div>
              )}

              {/* ── File bubble ── */}
              {isFile && (
                <div className={`bubble bubble-file ${isMine ? 'out' : 'in'}`}>
                  <span className="bubble-file-icon">{getFileIcon(message.fileName)}</span>
                  <div className="bubble-file-info">
                    <div className="bubble-file-name">{message.fileName || 'File'}</div>
                    <div className="bubble-file-size">{formatFileSize(message.fileSize)}</div>
                  </div>
                  {mediaUrl && (
                    <a href={mediaUrl} download={message.fileName}
                      className="bubble-file-dl"
                      onClick={e => e.stopPropagation()} title="Download">
                      ⬇️
                    </a>
                  )}
                  <div className="bubble-meta" style={{ marginTop: 0 }}>
                    <span>{formatTime(message.createdAt)}</span>
                    {isMine && <ReadTick status={message.status} read={message.read} />}
                  </div>
                </div>
              )}

              {/* ── Text bubble ── */}
              {isText && (
                <div className={`bubble ${isMine ? 'out' : 'in'}`}>
                  {editing ? (
                    <EditInput
                      value={message.content}
                      onSave={(newText) => { onEdit(message._id, newText); setEditing(false); }}
                      onCancel={() => setEditing(false)}
                    />
                  ) : (
                    <>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                      <div className="bubble-meta">
                        {message.edited && (
                          <span style={{ fontSize: '.65rem', opacity: .65, marginRight: 4 }}>edited</span>
                        )}
                        <span>{formatTime(message.createdAt)}</span>
                        {isMine && <ReadTick status={message.status} read={message.read} />}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Reactions bar */}
            {message.reactions?.length > 0 && (
              <div
                className="reactions-bar"
                style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}
              >
                {message.reactions.map(r => (
                  <button
                    key={r.emoji}
                    className="reaction-chip"
                    onClick={() => onReact(message._id, r.emoji)}
                  >
                    {r.emoji}
                    {r.users?.length > 1 && (
                      <span className="rc-count">{r.users.length}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context menu (right-click / long-press) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isMine={isMine}
          isText={isText}
          onReact={(emoji) => onReact(message._id, emoji)}
          onEdit={() => setEditing(true)}
          onDelete={() => onDelete(message._id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}