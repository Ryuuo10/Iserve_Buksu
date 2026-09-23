import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { getLoginRouteForRole } from '../utils/authRoutes';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [grievanceUpdates, setGrievanceUpdates] = useState({});
  const [systemMessage, setSystemMessage] = useState(null);

  useEffect(() => {
    // Connect to the Socket.IO server with JWT token from sessionStorage
    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    // Get token from sessionStorage (per-tab isolation) NOT localStorage
    const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
    const userId = sessionStorage.getItem('userId');

    if (!token || !userId) {
      console.log('ℹ️ No auth token in sessionStorage, skipping Socket.IO connection');
      return;
    }

    const newSocket = io(backendURL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
      // Pass JWT token for authentication
      auth: {
        token: `Bearer ${token}`,
        userId: userId
      }
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected to server');
      setIsConnected(true);

      // Join user's room with fresh auth from sessionStorage
      const currentToken = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
      const currentUserId = sessionStorage.getItem('userId');
      if (currentUserId) {
        newSocket.emit('join_user_room', {
          userId: currentUserId,
          token: currentToken
        });
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      // If auth fails, force logout from this tab
      if (error.message === 'Authentication failed') {
        const currentUserRole =
          sessionStorage.getItem('userRole') ||
          (() => {
            try {
              return JSON.parse(sessionStorage.getItem('user') || '{}')?.role;
            } catch {
              return null;
            }
          })();

        sessionStorage.removeItem('token');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('user');
        window.location.href = getLoginRouteForRole(currentUserRole);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('⚠️ Disconnected from server');
      setIsConnected(false);
    });

    // Listen for new notifications
    newSocket.on('new_notification', (notification) => {
      console.log('New notification:', notification);
      setNotifications((prev) => {
        const existingIndex = prev.findIndex((item) => item._id === notification._id);

        if (existingIndex !== -1) {
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], ...notification };
          return next;
        }

        return [notification, ...prev];
      });

      if (!notification?.read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Listen for notification count updates
    newSocket.on('live_counts_update', (counts) => {
      console.log('Live counts update:', counts);
      if (counts.unreadNotifications !== undefined) {
        setUnreadCount(counts.unreadNotifications);
      }
    });

    // Listen for grievance status changes
    newSocket.on('grievance_status_changed', (data) => {
      console.log('Grievance status changed:', data);
      setGrievanceUpdates((prev) => ({
        ...prev,
        [data.grievanceId]: data
      }));
    });

    // Listen for grievance updates
    newSocket.on('grievance_updated', (data) => {
      console.log('Grievance updated:', data);
      setGrievanceUpdates((prev) => ({
        ...prev,
        [data.grievanceId]: data.data
      }));
    });

    // Listen for system messages
    newSocket.on('system_message', (data) => {
      console.log('System message:', data);
      setSystemMessage(data);
    });

    // Listen for office announcements
    newSocket.on('office_announcement', (data) => {
      console.log('Office announcement:', data);
      setSystemMessage({
        message: data.announcement.message,
        type: 'info',
        timestamp: data.timestamp
      });
    });

    setSocket(newSocket);

    // Listen for auth changes within this tab
    const handleStorageChange = (e) => {
      // Only react to changes within THIS tab's sessionStorage context
      // sessionStorage is per-tab, so this helps detect when user logs out programmatically
      if (e.key === 'authToken' || e.key === 'token' || e.key === 'userId') {
        const newToken = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
        
        // If token was cleared (logout), disconnect socket
        if (!newToken && newSocket) {
          console.log('🔄 Auth token cleared in this tab, disconnecting socket...');
          newSocket.disconnect();
          setIsConnected(false);
          return;
        }
        
        // If token changed, reconnect with new token
        if (newToken && !newSocket.connected) {
          console.log('🔄 New token detected, reconnecting socket...');
          const newUserId = sessionStorage.getItem('userId');
          if (newUserId) {
            newSocket.auth = {
              token: `Bearer ${newToken}`,
              userId: newUserId
            };
            newSocket.connect();
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const emitEvent = useCallback((eventName, data) => {
    if (socket) {
      socket.emit(eventName, data);
    }
  }, [socket]);

  const value = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    grievanceUpdates,
    systemMessage,
    emitEvent,
    setUnreadCount,
    setNotifications,
    clearSystemMessage: () => setSystemMessage(null)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
