# Real-Time Features Implementation Guide

## Overview
Real-time capabilities have been added to the CAPSTONE grievance system using Socket.IO. This enables live updates for notifications, grievance status changes, and system messages without requiring manual page refreshes.

## What's New

### Backend Changes

#### 1. **Socket.IO Server Setup** (`server.js`)
- Integrated Socket.IO with HTTP server using `socket.io` package
- Configured CORS for WebSocket connections
- Implemented user room management for targeted broadcasts

#### 2. **Socket Event Utility** (`utils/socketEvents.js`)
New helper functions for emitting real-time events:
- `notifyUser(io, userId, notification)` - Send notification to specific user
- `broadcastGrievanceUpdate(io, grievanceId, grievanceData)` - Broadcast grievance updates
- `notifyGrievanceStatusChange(io, userId, grievanceId, status, message)` - Notify about status changes
- `updateLiveCounts(io, userId, counts)` - Update counts in real-time
- `sendSystemMessage(io, userId, message, type)` - Send system messages
- `broadcastOfficeAnnouncement(io, officeId, announcement)` - Broadcast office announcements

#### 3. **Updated Notification Routes** (`routes/notifications.js`)
- Added real-time event emissions when notifications are marked as read
- Integrated `updateLiveCounts` to broadcast unread count changes

### Frontend Changes

#### 1. **Socket Context** (`context/SocketContext.jsx`)
Provides global Socket.IO state management:
- `socket` - Socket.IO instance
- `isConnected` - Connection status
- `notifications` - Real-time notifications array
- `unreadCount` - Live unread count
- `grievanceUpdates` - Real-time grievance updates
- `systemMessage` - System notifications
- `emitEvent()` - Function to emit custom events

#### 2. **Custom Hooks** (`hooks/useRealTime.js`)
Easy-to-use hooks for components:
- `useRealTimeNotifications()` - Get notifications and unread count
- `useRealTimeGrievances()` - Get grievance updates
- `useRealTimeSystemMessages()` - Get system messages
- `useSocketConnection()` - Check connection status

#### 3. **App Component Update** (`App.jsx`)
- Wrapped application with `SocketProvider`
- Enables Socket.IO throughout entire app

#### 4. **Updated NotificationsModule** (Example)
Shows how to integrate real-time updates:
```jsx
import { useRealTimeNotifications } from '../hooks/useRealTime';

const NotificationsModule = () => {
  const { unreadCount, notifications, setUnreadCount } = useRealTimeNotifications();
  // Component automatically updates when new notifications arrive
};
```

## Usage Examples

### Example 1: Display Real-Time Notifications in a Component
```jsx
import { useRealTimeNotifications } from '../hooks/useRealTime';

function NotificationBadge() {
  const { unreadCount } = useRealTimeNotifications();
  
  return (
    <div className="notification-badge">
      {unreadCount} new notifications
    </div>
  );
}
```

### Example 2: Listen for Grievance Status Updates
```jsx
import { useRealTimeGrievances } from '../hooks/useRealTime';
import { useEffect } from 'react';

function GrievanceStatus() {
  const { grievanceUpdates, latestUpdate } = useRealTimeGrievances();
  
  useEffect(() => {
    if (latestUpdate) {
      console.log('Grievance updated:', latestUpdate);
      // Refresh UI or show notification
    }
  }, [latestUpdate]);
  
  return <div>Latest update: {latestUpdate?.status}</div>;
}
```

### Example 3: Emit Custom Events from Backend
```javascript
// In your route handler
const { notifyUser } = require('../utils/socketEvents');
const io = req.app.locals.io;

// When creating a new grievance
notifyUser(io, grievance.createdBy._id, {
  title: 'Grievance Created',
  message: `Your grievance "${grievance.subject}" has been created.`,
  type: 'grievance_submitted'
});
```

### Example 4: Broadcast System Message
```javascript
const { sendSystemMessage } = require('../utils/socketEvents');
const io = req.app.locals.io;

// Send to all connected users
sendSystemMessage(io, 'all', 'System maintenance at 8 PM', 'warning');

// Send to specific user
sendSystemMessage(io, userId, 'Your profile has been verified', 'success');
```

## Real-Time Events

### Server → Client Events
- **`new_notification`** - New notification for user
  ```
  { title, message, type, relatedGrievance, timestamp }
  ```

- **`live_counts_update`** - Updated counts
  ```
  { unreadNotifications, timestamp }
  ```

- **`grievance_status_changed`** - Grievance status change
  ```
  { grievanceId, status, message, timestamp }
  ```

- **`grievance_updated`** - Grievance data updated
  ```
  { grievanceId, data, timestamp }
  ```

- **`system_message`** - System-wide message
  ```
  { message, type, timestamp }
  ```

- **`office_announcement`** - Office announcement
  ```
  { officeId, announcement, timestamp }
  ```

### Client → Server Events
- **`join_user_room`** - Join user's personal room for notifications
  ```
  emit('join_user_room', userId)
  ```

- **`leave_user_room`** - Leave user's personal room
  ```
  emit('leave_user_room', userId)
  ```

## Environment Variables
Make sure your `.env` file includes:
```
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
```

And in frontend's `.env`:
```
VITE_BACKEND_URL=http://localhost:5000
```

## Installation & Setup

### Backend
```bash
cd backend
npm install socket.io
```

### Frontend
```bash
cd frontend
npm install socket.io-client
```

### Run Development Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Next Steps

### To extend with more real-time features:

1. **Add real-time updates for grievance creation:**
   ```javascript
   // In grievances route
   const { broadcastGrievanceUpdate } = require('../utils/socketEvents');
   broadcastGrievanceUpdate(io, grievance._id, grievance);
   ```

2. **Add live chat/comments:**
   - Create socket events for message exchanges
   - Store messages in database
   - Emit to relevant user rooms

3. **Add typing indicators:**
   - Emit 'user_typing' when user starts typing
   - Display indicator in UI

4. **Add connection status indicator:**
   ```jsx
   function ConnectionStatus() {
     const { isConnected } = useSocketConnection();
     return (
       <div className={isConnected ? 'bg-green-500' : 'bg-red-500'}>
         {isConnected ? 'Connected' : 'Disconnected'}
       </div>
     );
   }
   ```

## Troubleshooting

### Socket.IO not connecting
- Check backend is running and listening on correct port
- Ensure FRONTEND_URL in backend .env matches your frontend URL
- Check browser console for CORS errors
- Verify socket.io client version matches server version

### Events not being received
- Make sure user joins their room after authentication
- Check that Socket.IO is accessible through `req.app.locals.io`
- Verify event names match exactly between client and server

### Performance considerations
- Implement event debouncing for frequent updates
- Use room-based broadcasting to avoid sending to all clients
- Monitor Socket.IO memory usage with many concurrent connections
- Consider using Socket.IO adapters for multi-server scaling

## Resources
- [Socket.IO Documentation](https://socket.io/docs/)
- [Socket.IO React Integration](https://socket.io/blog/socket-io-3-1-0-and-react-18/)
