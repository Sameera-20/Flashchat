import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socket) { socket.disconnect(); setSocket(null); setConnected(false); }
      return;
    }

    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => { console.log('🔌 Socket connected'); setConnected(true); });
    newSocket.on('disconnect', () => { setConnected(false); });
    newSocket.on('users:online', (users) => setOnlineUsers(users));
    newSocket.on('connect_error', (err) => console.error('Socket error:', err.message));

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [token, user?._id]);

  const isUserOnline = (userId) => onlineUsers.includes(userId?.toString());

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers, isUserOnline }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};