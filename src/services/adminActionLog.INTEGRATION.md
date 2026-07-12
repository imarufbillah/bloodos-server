# Admin Action Log Service - Integration Guide

## Overview

The Admin Action Log Service provides audit trail functionality for all administrative actions in BloodOS. This document shows how to integrate it into admin routes (Phase 5 units).

## When to Use

Call `logAdminAction` whenever an admin user performs any of these actions:

1. **Approve/Reject Request** (`AdminActionType.APPROVE_REQUEST` / `REJECT_REQUEST`)
2. **Modify Request** (`AdminActionType.MODIFY_REQUEST`)
3. **Verify Donation** (`AdminActionType.VERIFY_DONATION`)
4. **Ban/Unban User** (`AdminActionType.BAN_USER` / `UNBAN_USER`)
5. **Change User Role** (`AdminActionType.CHANGE_USER_ROLE`)

## Basic Usage Pattern

```typescript
import { logAdminAction, extractChangedFields } from "../services/index.js";
import { AdminActionType } from "../types/shared.js";

// In your admin controller/route handler:
async function adminEditRequest(req, res) {
  const { id } = req.params;
  const updates = req.body;
  const sessionUser = req.sessionUser; // From auth middleware
  
  // 1. Fetch the existing resource
  const request = await getBloodRequestsCollection().findOne({ 
    _id: new ObjectId(id) 
  });
  
  if (!request) {
    throw new AppError("not_found", "Request not found", 404);
  }
  
  // 2. Apply the updates
  const updated = await getBloodRequestsCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  
  // 3. Log the admin action with before/after state
  await logAdminAction({
    adminId: new ObjectId(sessionUser.id),
    action: AdminActionType.MODIFY_REQUEST,
    targetType: "request",
    targetId: new ObjectId(id),
    previousState: { ...request },
    newState: { ...updated.value },
    reason: req.body.reason, // Optional
    ipAddress: req.ip || "unknown"
  });
  
  return res.json({ data: updated.value });
}
```

## Using `extractChangedFields` Helper

For efficiency, especially with large documents, use `extractChangedFields` to log only what changed:

```typescript
import { logAdminAction, extractChangedFields } from "../services/index.js";

// Before updating
const previousRequest = await getBloodRequestsCollection().findOne({ 
  _id: requestId 
});

// After updating
const updatedRequest = await getBloodRequestsCollection().findOne({ 
  _id: requestId 
});

// Extract only changed fields (Req 10.8)
const { previousState, newState } = extractChangedFields(
  previousRequest as Record<string, unknown>,
  updatedRequest as Record<string, unknown>
);

// Log with minimal state capture
await logAdminAction({
  adminId: new ObjectId(sessionUser.id),
  action: AdminActionType.MODIFY_REQUEST,
  targetType: "request",
  targetId: requestId,
  previousState,
  newState,
  ipAddress: req.ip || "unknown"
});
```

## Examples by Action Type

### 1. Verify Donation (Req 10.4)

```typescript
// PATCH /api/admin/donations/:id/verify
async function verifyDonation(req, res) {
  const { id } = req.params;
  const sessionUser = req.sessionUser;
  
  const donation = await getDonationsCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { 
      $set: { 
        verified: true, 
        verifiedBy: new ObjectId(sessionUser.id),
        verifiedAt: new Date()
      } 
    },
    { returnDocument: "after" }
  );
  
  await logAdminAction({
    adminId: new ObjectId(sessionUser.id),
    action: AdminActionType.VERIFY_DONATION,
    targetType: "donation",
    targetId: new ObjectId(id),
    previousState: { verified: false },
    newState: { 
      verified: true, 
      verifiedBy: sessionUser.id,
      verifiedAt: new Date().toISOString() 
    },
    ipAddress: req.ip || "unknown"
  });
  
  // Also trigger notification to donor
  await notify({
    userId: donation.value!.userId,
    type: NotificationType.DONATION_VERIFIED,
    // ... notification details
  });
  
  return res.json({ data: donation.value });
}
```

### 2. Ban User (Req 10.5)

```typescript
// PATCH /api/admin/users/:id/ban
async function banUser(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const sessionUser = req.sessionUser;
  
  const user = await getUsersCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { banned: true, bannedAt: new Date() } },
    { returnDocument: "after" }
  );
  
  await logAdminAction({
    adminId: new ObjectId(sessionUser.id),
    action: AdminActionType.BAN_USER,
    targetType: "user",
    targetId: new ObjectId(id),
    previousState: { banned: false },
    newState: { banned: true, bannedAt: new Date().toISOString() },
    reason, // Capture the ban reason
    ipAddress: req.ip || "unknown"
  });
  
  return res.json({ data: user.value });
}
```

### 3. Unban User (Req 10.6)

```typescript
// PATCH /api/admin/users/:id/unban
async function unbanUser(req, res) {
  const { id } = req.params;
  const sessionUser = req.sessionUser;
  
  const user = await getUsersCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { banned: false }, $unset: { bannedAt: "" } },
    { returnDocument: "after" }
  );
  
  await logAdminAction({
    adminId: new ObjectId(sessionUser.id),
    action: AdminActionType.UNBAN_USER,
    targetType: "user",
    targetId: new ObjectId(id),
    previousState: { banned: true },
    newState: { banned: false },
    ipAddress: req.ip || "unknown"
  });
  
  return res.json({ data: user.value });
}
```

### 4. Change User Role

```typescript
// PATCH /api/admin/users/:id/role
async function changeUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body; // "user" | "admin"
  const sessionUser = req.sessionUser;
  
  // Prevent self-demotion
  if (id === sessionUser.id && role === "user") {
    throw new AppError("forbidden", "Cannot demote yourself", 403);
  }
  
  const user = await getUsersCollection().findOne({ _id: new ObjectId(id) });
  
  if (!user) {
    throw new AppError("not_found", "User not found", 404);
  }
  
  const updated = await getUsersCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { role } },
    { returnDocument: "after" }
  );
  
  await logAdminAction({
    adminId: new ObjectId(sessionUser.id),
    action: AdminActionType.CHANGE_USER_ROLE,
    targetType: "user",
    targetId: new ObjectId(id),
    previousState: { role: user.role },
    newState: { role },
    ipAddress: req.ip || "unknown"
  });
  
  return res.json({ data: updated.value });
}
```

### 5. Delete Request (Admin Override)

```typescript
// DELETE /api/requests/:id (with admin override)
async function deleteRequest(req, res) {
  const { id } = req.params;
  const sessionUser = req.sessionUser;
  
  const request = await getBloodRequestsCollection().findOne({ 
    _id: new ObjectId(id) 
  });
  
  if (!request) {
    throw new AppError("not_found", "Request not found", 404);
  }
  
  // Check if admin is acting on non-owned resource
  const isAdminOverride = 
    request.userId.toString() !== sessionUser.id && 
    sessionUser.role === "admin";
  
  // Perform the deletion
  await getBloodRequestsCollection().deleteOne({ 
    _id: new ObjectId(id) 
  });
  
  // Log if this was an admin override (Req 5.5)
  if (isAdminOverride) {
    await logAdminAction({
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.MODIFY_REQUEST, // Or use a DELETE action if added
      targetType: "request",
      targetId: new ObjectId(id),
      previousState: { status: request.status },
      newState: { deleted: true },
      reason: "Admin deleted non-owned request",
      ipAddress: req.ip || "unknown"
    });
  }
  
  return res.json({ message: "Request deleted successfully" });
}
```

## Error Handling

The `logAdminAction` function will throw an error if the log write fails. This is intentional — audit failures should be visible and prevent the operation from appearing successful:

```typescript
try {
  // Perform the mutation
  await updateResource();
  
  // Log it
  await logAdminAction({
    // ... params
  });
  
  return res.json({ success: true });
} catch (error) {
  // If either the mutation OR the audit log fails, return error
  console.error("Operation failed:", error);
  throw error; // Let error middleware handle it
}
```

## Query Helpers for Admin Dashboard

The service also provides query helpers for building admin dashboards:

```typescript
import { 
  getAdminActionsByAdmin,
  getAdminActionsByTarget,
  getRecentAdminActions 
} from "../services/index.js";

// Get all actions by a specific admin
const adminActions = await getAdminActionsByAdmin(
  new ObjectId(adminId),
  100 // limit
);

// Get audit history for a specific resource
const requestHistory = await getAdminActionsByTarget(
  "request",
  new ObjectId(requestId),
  50 // limit
);

// Get platform-wide recent actions
const recentActions = await getRecentAdminActions(50);
```

## Integration Checklist for Phase 5 Units

When implementing admin routes, ensure:

- [ ] `logAdminAction` is called **after** the mutation succeeds, but **before** returning success to client
- [ ] `previousState` and `newState` capture only relevant changed fields (use `extractChangedFields` helper)
- [ ] `ipAddress` is captured from `req.ip` or similar
- [ ] `reason` is captured when available (especially for bans/role changes)
- [ ] Admin override scenarios (Req 5.5) are logged even on seemingly "normal" routes
- [ ] Errors from `logAdminAction` are not silently swallowed

## Requirements Coverage

This service satisfies:

- **Req 10.1**: Complete schema with all 7 action types
- **Req 10.2-10.7**: Action types for edit, delete, verify, ban, unban, role-change
- **Req 10.8**: State capture of relevant fields only, not full dumps
- **Req 10.9**: Timestamp capture (automatic in service)
- **Req 10.10**: IP address capture
- **Req 5.5**: Admin override detection and logging
- **Req 8.7**: Indexes for efficient querying (`adminId`, `timestamp`, `targetType+targetId`)

---

**Next Steps**: Phase 5 units (5e, 5f, 5h) will import and use this service in their admin route implementations.
