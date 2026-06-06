import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useChat = (activeRoom) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  // Load message history when room changes
  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      return;
    }
    loadMessages();
  }, [activeRoom]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !activeRoom) return;

    socket.emit('room:join', { roomId: activeRoom._id });

    const handleReceive = (msg) => {
      setMessages(prev => {
        const exists = prev.find(m => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
    };

    const handleTyping = ({ userId, username, isTyping }) => {
      if (userId === user._id) return;
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.find(u => u.userId === userId)) return prev;
          return [...prev, { userId, username }];
        } else {
          return prev.filter(u => u.userId !== userId);
        }
      });
    };

    const handleReaction = ({ messageId, reactions }) => {
      setMessages(prev =>
        prev.map(m => m._id === messageId ? { ...m, reactions } : m)
      );
    };

    socket.on('message:receive', handleReceive);
    socket.on('typing:update', handleTyping);
    socket.on('message:reacted', handleReaction);

    return () => {
      socket.emit('room:leave', { roomId: activeRoom._id });
      socket.off('message:receive', handleReceive);
      socket.off('typing:update', handleTyping);
      socket.off('message:reacted', handleReaction);
      setTypingUsers([]);
    };
  }, [socket, activeRoom, user]);

  const loadMessages = async () => {
    if (!activeRoom) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/rooms/${activeRoom._id}/messages`);
      setMessages(res.data.messages);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback((content) => {
    if (!socket || !activeRoom || !content.trim()) return;
    socket.emit('message:send', { roomId: activeRoom._id, content });
    stopTyping();
  }, [socket, activeRoom]);

  const startTyping = useCallback(() => {
    if (!socket || !activeRoom) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { roomId: activeRoom._id });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2000);
  }, [socket, activeRoom]);

  const stopTyping = useCallback(() => {
    if (!socket || !activeRoom) return;
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing:stop', { roomId: activeRoom._id });
    }
    clearTimeout(typingTimerRef.current);
  }, [socket, activeRoom]);

  const reactToMessage = useCallback((messageId, emoji) => {
    if (!socket || !activeRoom) return;
    socket.emit('message:react', {
      messageId,
      emoji,
      roomId: activeRoom._id
    });
  }, [socket, activeRoom]);

  return {
    messages,
    typingUsers,
    loading,
    sendMessage,
    startTyping,
    stopTyping,
    reactToMessage
  };
};
