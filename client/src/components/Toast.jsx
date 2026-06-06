import React from 'react';

const COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626'];
const getColor = (name) => {
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

export default function Toast({ sender, content }) {
  return (
    <div className="toast">
      <div className="toast-avatar" style={{ background: getColor(sender?.username) }}>
        {sender?.avatar
          ? <img src={sender.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : (sender?.username || '?')[0].toUpperCase()
        }
      </div>
      <div className="toast-body">
        <strong>{sender?.username || 'Someone'}</strong>
        <span>{content?.slice(0, 60)}{content?.length > 60 ? '…' : ''}</span>
      </div>
    </div>
  );
}