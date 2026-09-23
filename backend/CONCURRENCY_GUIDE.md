# Concurrency Control Implementation Guide

## Overview

This system implements optimistic locking and MongoDB transactions to handle concurrent updates safely. This ensures that when multiple users update the same grievance simultaneously, conflicts are detected and handled gracefully.

## What's New

### 1. **Version-Based Optimistic Locking**
Every grievance has a `__v` (version) field that increments each time it's updated. The frontend should:
- Fetch the current version when displaying a grievance
- Send the version with every update request
- Handle conflict responses (HTTP 409)

### 2. **Atomic Transactions**
Critical operations (status change + notification + audit) happen atomically - either all succeed or all fail.

### 3. **Real-Time Conflict Notifications**
When a conflict is detected, the user gets a Socket.io notification immediately showing:
- What was updated
- Who updated it
- Current version state
- Suggestion to refresh and retry

## API Changes

### Update Grievance Status
```javascript
// Old (still works for backward compatibility):
PUT /api/admin/grievances/:id/status
{
  "status": "resolved",
  "resolutionNotes": "Issue resolved"
}

// New (recommended):
PUT /api/admin/grievances/:id/status
{
  "status": "resolved",
  "resolutionNotes": "Issue resolved",
  "version": 3  // Include version from GET response
}
```

### Response on Conflict (HTTP 409)
```json
{
  "success": false,
  "conflict": true,
  "message": "This document was updated by another user",
  "currentVersion": 4,
  "currentState": {
    "status": "in_progress",
    "priority": "high",
    "lastUpdatedBy": "admin123",
    "updatedAt": "2026-03-25T10:30:00Z"
  },
  "incomingChanges": {
    "status": "resolved"
  },
  "suggestion": "Refresh the page to see latest changes, then try again"
}
```

### All Update Endpoints Support Version
- `PUT /api/admin/grievances/:id` - Main update (status, office)
- `PUT /api/admin/grievances/:id/status` - Status-only update
- `PUT /api/admin/grievances/:id/assign` - Assignment
- `DELETE /api/admin/grievances/:id` - Archive/Delete

## Frontend Implementation

### 1. Store Version When Fetching Grievance
```javascript
// In React component
const [grievance, setGrievance] = useState(null);
const [version, setVersion] = useState(null);

useEffect(() => {
  fetchGrievance();
}, []);

const fetchGrievance = async () => {
  const res = await fetch(`/api/admin/grievances/${grievanceId}`);
  const data = await res.json();
  setGrievance(data.data);
  setVersion(data.data.__v); // Store version
};
```

### 2. Send Version with Updates
```javascript
const updateStatus = async (newStatus) => {
  try {
    const res = await fetch(`/api/admin/grievances/${grievanceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        version: version, // Send current version
      }),
    });

    if (res.status === 409) {
      // Conflict detected
      const conflict = await res.json();
      handleConflict(conflict);
      return;
    }

    const data = await res.json();
    setGrievance(data.data);
    setVersion(data.data.__v); // Update version
    showSuccess('Grievance updated');
  } catch (error) {
    showError(error.message);
  }
};
```

### 3. Handle Conflicts
```javascript
const handleConflict = (conflict) => {
  // Show conflict dialog to user
  showConflictDialog({
    message: conflict.message,
    currentState: conflict.currentState,
    yourChanges: conflict.incomingChanges,
    options: [
      {
        label: 'Refresh and Retry',
        action: () => {
          fetchGrievance(); // Refresh to get latest version
          // User can then retry the update
        },
      },
      {
        label: 'Discard Changes',
        action: () => closeDialog(),
      },
      {
        label: 'Override (Admin Only)',
        action: () => retryWithoutVersion(), // Force update—use carefully
      },
    ],
  });
};
```

### 4. Listen for Real-Time Conflicts
```javascript
useEffect(() => {
  // Set up Socket.io listeners
  socket.on('grievance_conflict_detected', (data) => {
    console.warn('Conflict detected for grievance:', data.grievanceId);
    showConflictNotification(data.conflict);
    // Auto-refresh after 2 seconds
    setTimeout(() => fetchGrievance(), 2000);
  });

  socket.on('grievance_update_warning', (data) => {
    console.log('Another user updating:', data.warning);
    showInfoToast(`${data.warning.message || 'Document is being updated'}`);
  });

  socket.on('grievance_successfully_updated', (data) => {
    if (data.grievanceId === grievanceId) {
      console.log('Successfully updated by:', data.update.updatedBy);
      setTimeout(() => fetchGrievance(), 1000);
    }
  });

  return () => {
    socket.off('grievance_conflict_detected');
    socket.off('grievance_update_warning');
    socket.off('grievance_successfully_updated');
  };
}, [grievanceId]);
```

## Best Practices

### DO:
✅ Always fetch version when loading grievance  
✅ Include version in all update requests  
✅ Handle HTTP 409 conflicts gracefully  
✅ Implement UI that shows conflict state  
✅ Refresh before retrying after conflict  
✅ Use auto-retry with exponential backoff for race conditions  

### DON'T:
❌ Ignore version field - it's required to prevent data loss  
❌ Retry immediately without getting new version  
❌ Override conflicts without user confirmation  
❌ Cache grievance data without version  
❌ Fire multiple updates in rapid succession  

## Scenarios

### Scenario 1: Concurrent Status Updates (HANDLED)
```
Officer A reads grievance v=1, status=pending
Officer B reads grievance v=1, status=pending

Officer A updates to resolved (sends v=1)
  → Success! v becomes 2

Officer B tries to update to escalated (sends v=1)  
  → Conflict! (409) - "Document was modified by another user"
  → User sees conflict dialog
  → User clicks to refresh
  → Gets latest version
  → Can retry update
```

### Scenario 2: Concurrent Assignment (HANDLED)
```
Admin1 assigns to Officer A (locks version)
Admin2 tries to assign to Officer B simultaneously
  → Detected conflict
  → Admin2 gets notification
  → Can retry safely
```

### Scenario 3: Multi-Tab Same Officer (HANDLED)
```
Officer opens grievance in Tab 1 and Tab 2
Updates status in Tab 1 → Success
Tries to update in Tab 2 → Conflict detected
  → Gets real-time warning via Socket.io
  → Can refresh Tab 2 and retry
```

## Performance Notes

- **Database**: Added 1 extra field (`__v`) per grievance - negligible storage
- **Network**: Version field adds ~20 bytes per request
- **Transactions**: Use only for critical operations - minimal overhead
- **Socket.io**: New events are lightweight, only sent on conflicts

## Error Codes

| Code | Meaning | Resolution |
|------|---------|-----------|
| 200 | Success | Continue normally |
| 400 | Bad Request | Check required fields |
| 404 | Not Found | Grievance doesn't exist |
| 409 | Conflict | Version mismatch - refresh and retry |
| 500 | Server Error | Retry after short delay |

## Backward Compatibility

- Routes still work without `version` field (for legacy clients)
- If no version provided, update proceeds without locking
- But this defeats concurrency protection - **always use version for new code**

## Testing Concurrency

```javascript
// Simulate concurrent updates for testing
const testConcurrency = async () => {
  const grievanceId = '123';
  
  // Fetch version
  const res1 = await fetch(`/api/admin/grievances/${grievanceId}`);
  const { data: g, __v: v } = await res1.json();
  
  // Create two concurrent requests with same version
  const updates = [
    fetch(`/api/admin/grievances/${grievanceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', version: v }),
    }),
    fetch(`/api/admin/grievances/${grievanceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'escalated', version: v }),
    }),
  ];
  
  const results = await Promise.all(updates);
  // One should succeed (200), one should fail (409)
  results.forEach((r, i) => console.log(`Request ${i}:`, r.status));
};
```

## Migration from Old API

If you have existing frontend code, here's how to update it:

```javascript
// BEFORE:
const res = await fetch(`/api/admin/grievances/${id}/status`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'resolved' }),
});

// MIN upgrade (add version, handle conflict):
const grievance = await fetchGrievance(); // Must fetch version first
const res = await fetch(`/api/admin/grievances/${id}/status`, {
  method: 'PUT',
  body: JSON.stringify({ 
    status: 'resolved',
    version: grievance.__v, // NEW
  }),
});

if (res.status === 409) {
  // NEW - handle conflict
  const conflict = await res.json();
  alert(conflict.suggestion);
}
```

## Troubleshooting

### "Document was modified" appearing frequently?
- Normal in high-concurrency scenarios
- Check if multiple officers work on same grievances often
- Consider implementing queue-based assignment

### Socket.io notifications not appearing?
- Ensure Socket.io connection is established
- Check Network tab in browser DevTools
- Verify user joined room: `socket.on('connect', () => socket.emit('join_user_room', userId))`

### Conflicts still being lost?
- Verify `version` field is being sent with every update
- Check browser console for errors
- Ensure latest frontend code is deployed

## Support

For issues or questions about the concurrency system, check:
1. Backend logs: `node server.js`
2. Browser console: `F12 > Console`
3. Network tab: Check response bodies
4. Server health: `GET /api/health`
