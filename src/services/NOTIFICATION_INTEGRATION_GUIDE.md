# Notification Service Integration Guide for Phase 5

Quick reference for integrating notification.service.ts into your route handlers.

---

## Import Statement

```typescript
import {
  notifyNewMatchingRequest,
  notifyNewResponse,
  notifyResponseStatusChange,
  notifyRequestStatusChange,
  notifyContactInfoRequested,
  notifyDonationVerified,
  notifyRequestExpiringSoon,
  notifySystemAnnouncement,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} from '../services/notification.service.js';
```

---

## Phase 5a — Requests Controller

### POST /api/requests (Create Request)
```typescript
// After successfully creating the request
try {
  await notifyNewMatchingRequest(createdRequest);
} catch (error) {
  // Log but don't fail the request creation
  console.error('Failed to notify eligible donors:', error);
}
```

### PATCH /api/requests/:id/status (Change Status)
```typescript
// After status change, if request has responses
if (newStatus === 'fulfilled' || newStatus === 'cancelled' || newStatus === 'expired') {
  const responses = await getResponsesCollection()
    .find({ requestId: new ObjectId(requestId) })
    .toArray();
  
  const responderIds = responses.map(r => r.userId);
  
  if (responderIds.length > 0) {
    try {
      await notifyRequestStatusChange(
        responderIds,
        newStatus,
        request._id,
        request.patientName
      );
    } catch (error) {
      console.error('Failed to notify responders:', error);
    }
  }
}
```

---

## Phase 5b — Responses Controller

### POST /api/requests/:id/respond (Donor Responds)
```typescript
// After successfully creating the response
try {
  await notifyNewResponse(
    request.userId,      // Request owner
    req.sessionUser._id, // Donor
    req.sessionUser.name,
    request._id
  );
} catch (error) {
  console.error('Failed to notify request owner:', error);
}
```

### PATCH /api/requests/:id/responses/:responseId (Update Response Status)
```typescript
// After accepting or declining a response
try {
  await notifyResponseStatusChange(
    response.userId,     // The donor
    newStatus,           // 'accepted' or 'declined'
    request._id,
    request.patientName
  );
} catch (error) {
  console.error('Failed to notify donor:', error);
}
```

---

## Phase 5c — Donors Controller

### POST /api/donors/:id/request-contact (Request Contact Info)
```typescript
// After successfully logging to ContactAuditLog
try {
  await notifyContactInfoRequested(
    new ObjectId(donorId),  // Donor whose info was revealed
    req.sessionUser._id,    // Requestor
    req.sessionUser.name,
    requestId ? new ObjectId(requestId) : undefined
  );
} catch (error) {
  console.error('Failed to notify donor:', error);
}
```

---

## Phase 5d — Notifications Controller

### GET /api/notifications
```typescript
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.sessionUser._id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const unreadOnly = req.query.unreadOnly === 'true';

  const result = await getUserNotifications(userId, { page, limit, unreadOnly });

  res.json({
    data: result.notifications,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      totalCount: result.total,
      hasNextPage: page * limit < result.total,
      hasPrevPage: page > 1,
    },
    unreadCount: result.unreadCount,
  });
});
```

### PATCH /api/notifications/:id/read
```typescript
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notificationId = new ObjectId(id);

  // First verify ownership
  const notification = await getNotificationsCollection().findOne({
    _id: notificationId,
  });

  if (!notification) {
    throw new AppError('not_found', 'Notification not found', 404);
  }

  if (!notification.userId.equals(req.sessionUser._id)) {
    throw new AppError('forbidden', 'You can only mark your own notifications as read', 403);
  }

  const success = await markNotificationAsRead(notificationId);

  if (!success) {
    throw new AppError('internal_error', 'Failed to mark notification as read', 500);
  }

  res.json({ success: true, message: 'Notification marked as read' });
});
```

### PATCH /api/notifications/read-all
```typescript
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.sessionUser._id;
  const count = await markAllNotificationsAsRead(userId);

  res.json({
    success: true,
    message: `${count} notifications marked as read`,
    count,
  });
});
```

### GET /api/notifications/unread-count
```typescript
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.sessionUser._id;
  const count = await getUnreadNotificationCount(userId);

  res.json({ count });
});
```

---

## Phase 5h — User/Donations Controller

### PATCH /api/admin/donations/:id/verify (Admin Verifies Donation)
```typescript
// After successfully verifying the donation
try {
  await notifyDonationVerified(
    donation.userId,
    donation._id,
    donation.donationDate
  );
} catch (error) {
  console.error('Failed to notify donor:', error);
}
```

---

## Phase 5e/5f — Admin Controller

### POST /api/admin/announcements (System Announcement)
```typescript
export const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, message, filter } = req.body;

  // Validate input
  const schema = z.object({
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    filter: z.object({
      bloodGroup: z.enum(BLOOD_GROUPS).optional(),
      district: z.enum(DISTRICTS).optional(),
      isDonor: z.boolean().optional(),
    }).optional(),
  });

  const validated = schema.parse(req.body);

  await notifySystemAnnouncement(
    validated.title,
    validated.message,
    validated.filter
  );

  res.json({
    success: true,
    message: 'Announcement sent successfully',
  });
});
```

---

## Error Handling Best Practice

All notification calls should be wrapped in try-catch to prevent notification failures from breaking the main operation:

```typescript
// ✅ GOOD: Log error but don't fail the request
try {
  await notifyNewMatchingRequest(request);
} catch (error) {
  console.error('Notification failed:', error);
  // Continue - the request was created successfully
}

// ❌ BAD: Don't let notification failures break the main flow
await notifyNewMatchingRequest(request); // If this throws, request creation fails
```

### Exception: Critical Notifications
For critical notifications where you want to ensure delivery, let it throw:

```typescript
// If notification is critical to the workflow
await notifyContactInfoRequested(donorId, requestorId, name, requestId);
// Throws if fails - contact reveal transaction will fail
```

---

## Background Job Setup

Create a scheduled job (e.g., using node-cron) in your server entry point:

```typescript
// src/index.ts or src/app.ts
import cron from 'node-cron';
import { notifyExpiringRequests } from './services/notification.service.js';

// Run daily at 1 AM
cron.schedule('0 1 * * *', async () => {
  console.log('[CRON] Running expiring requests notification job...');
  try {
    await notifyExpiringRequests();
    console.log('[CRON] Expiring requests job completed successfully');
  } catch (error) {
    console.error('[CRON] Expiring requests job failed:', error);
  }
});
```

---

## Testing Checklist

When testing your routes that call notification functions:

- [ ] New request creates notifications for eligible donors only
- [ ] No notification sent if no eligible donors (verify logs)
- [ ] Donor response notifies request owner
- [ ] Response status change notifies donor
- [ ] Request status change notifies all responders
- [ ] Contact reveal notifies donor
- [ ] Donation verification notifies donor
- [ ] System announcement reaches filtered users
- [ ] Notification failures don't break main operations
- [ ] All notifications have `isRead: false` and `createdAt` set

---

## Common Issues and Solutions

### Issue: Notification not appearing
- Check user is eligible (not banned, correct district/blood type)
- Verify notification was created in DB: `db.notifications.find({ userId: ObjectId("...") })`
- Check `isRead` filter if using `unreadOnly: true`

### Issue: Duplicate notifications
- Check if route handler is being called multiple times
- Verify transaction logic doesn't retry notification calls

### Issue: Performance with many donors
- System is optimized with bulk inserts
- If still slow, consider moving to background queue (Bull, BullMQ)

### Issue: Expiry notifications not running
- Verify cron job is registered and running
- Check server logs for cron execution
- Verify MongoDB date queries are working (timezone issues)

---

## Quick Debugging

```typescript
// Log notification creation
console.log('Creating notification:', {
  type: 'new_response',
  userId: userId.toString(),
  relatedRequestId: requestId.toString(),
});

// Check if user exists
const user = await getUsersCollection().findOne({ _id: userId });
console.log('User found:', !!user, user?.email);

// Check if notification was created
const notification = await getNotificationsCollection().findOne({
  userId,
  type: 'new_response',
}, { sort: { createdAt: -1 } });
console.log('Notification created:', !!notification);
```

---

## Reference: All 8 Notification Types

| Type | Trigger | Recipient | Handler Function |
|------|---------|-----------|------------------|
| new_response | Donor responds to request | Request owner | `notifyNewResponse()` |
| response_status_change | Owner accepts/declines response | Donor | `notifyResponseStatusChange()` |
| request_status_change | Request status changes | All responders | `notifyRequestStatusChange()` |
| new_matching_request | New request created | Eligible donors | `notifyNewMatchingRequest()` |
| donation_verified | Admin verifies donation | Donor | `notifyDonationVerified()` |
| request_expiring_soon | 24h before expiry | Request owner | `notifyRequestExpiringSoon()` |
| system_announcement | Admin sends announcement | Filtered users | `notifySystemAnnouncement()` |
| contact_info_requested | Someone requests contact | Donor | `notifyContactInfoRequested()` |

---

## Need Help?

- Check service JSDoc comments for parameter details
- See `PHASE_4A_COMPLETE.md` for full documentation
- Review `__tests__/notification.service.test.md` for edge cases
- Verify MongoDB indexes are created (Phase 1b)

---

**Good luck with Phase 5 integration!** 🚀
