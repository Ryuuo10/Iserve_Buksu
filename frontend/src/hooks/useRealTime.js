import { useSocket } from '../context/SocketContext';
import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to use real-time notifications
 * Returns: { unreadCount, notifications, setUnreadCount, setNotifications }
 */
export const useRealTimeNotifications = () => {
  const { unreadCount, notifications, setUnreadCount, setNotifications } = useSocket();
  
  return {
    unreadCount,
    notifications,
    setUnreadCount,
    setNotifications
  };
};

/**
 * Hook to use real-time grievance updates
 * Returns: { grievanceUpdates, latestUpdate }
 */
export const useRealTimeGrievances = () => {
  const { grievanceUpdates } = useSocket();
  const [latestUpdate, setLatestUpdate] = useState(null);

  useEffect(() => {
    if (Object.keys(grievanceUpdates).length > 0) {
      const updates = Object.values(grievanceUpdates);
      setLatestUpdate(updates[updates.length - 1]);
    }
  }, [grievanceUpdates]);

  return {
    grievanceUpdates,
    latestUpdate
  };
};

/**
 * Hook to use real-time system messages
 * Returns: { systemMessage, clearMessage }
 */
export const useRealTimeSystemMessages = () => {
  const { systemMessage, clearSystemMessage } = useSocket();

  return {
    systemMessage,
    clearMessage: clearSystemMessage
  };
};

/**
 * Hook to check socket connection status
 * Returns: { isConnected }
 */
export const useSocketConnection = () => {
  const { isConnected } = useSocket();

  return { isConnected };
};
