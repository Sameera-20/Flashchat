import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import RightPanel from '../components/RightPanel';
import Toast from '../components/Toast';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [activeConv, setActiveConv] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [toast, setToast] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [sharedMedia, setSharedMedia] = useState([]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Reset shared media when conversation changes
  useEffect(() => {
    setSharedMedia([]);
  }, [activeConv?._id]);

  // Toast for incoming messages from OTHER conversations
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      const msgConvId = msg.conversationId || msg.conversation;
      if (!activeConv || msgConvId?.toString() !== activeConv._id?.toString()) {
        setToast({ sender: msg.sender, content: msg.content || '📎 Attachment' });
        setTimeout(() => setToast(null), 4000);
      }
    };
    socket.on('message:receive', handler);
    return () => socket.off('message:receive', handler);
  }, [socket, activeConv]);

  const handleSelectConv = useCallback((conv) => {
    setActiveConv(conv);
    setSharedMedia([]);
    setMobileSidebarOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    setMobileSidebarOpen(true);
    setActiveConv(null);
    setSharedMedia([]);
  }, []);

  const handleMediaUpdate = useCallback((mediaUrls) => {
    setSharedMedia(mediaUrls);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <div className="app-layout">
      {/* Sidebar — conversation list */}
      <Sidebar
        activeConv={activeConv}
        onSelectConv={handleSelectConv}
        currentUser={user}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
        mobileSidebarOpen={mobileSidebarOpen}
      />

      {/* Main chat area */}
      <ChatWindow
        conv={activeConv}
        currentUser={user}
        onBack={handleBack}
        onInfoClick={() => setShowRightPanel(p => !p)}
        onMediaUpdate={handleMediaUpdate}
      />

      {/* Right panel — contact info + shared media */}
      {showRightPanel && activeConv && (
        <RightPanel
          conv={activeConv}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setShowRightPanel(false)}
          onLogout={logout}
          sharedMedia={sharedMedia}
        />
      )}

      {/* Toast notification for background messages */}
      {toast && (
        <Toast sender={toast.sender} content={toast.content} />
      )}
    </div>
  );
}