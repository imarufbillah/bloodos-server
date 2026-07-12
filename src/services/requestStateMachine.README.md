# BloodRequest State Machine Service

## Overview

The `RequestStateMachineService` implements the complete state transition logic for blood donation requests in BloodOS, fulfilling Requirements 3.1–3.9 from the specification.

## Status Flow Diagram

```
┌──────┐
│ OPEN │ ──────────────────────────────────┐
└──┬───┘                                    │
   │                                        │
   │ First "offered" response (auto)       │ Owner/Admin: Cancel
   │                                        │
   ▼                                        │
┌──────────────┐                           │
│ IN_PROGRESS  │                           │
└──────┬───────┘                           │
       │                                    │
       │ Owner/Admin: Fulfill               │
       │                                    │
       ▼                                    ▼
┌────────────┐                      ┌───────────┐
│ FULFILLED  │◄─ TERMINAL           │ CANCELLED │◄─ TERMINAL (admin can revive)
└────────────┘                      └───────────┘

       │                                    │
       │ neededByDate passes                │
       ▼                                    ▼
   ┌──────────┐                      ┌──────────┐
   │ EXPIRED  │──────────────────────│ EXPIRED  │
   └────┬─────┘                      └──────────┘
        │
        │ Owner/Admin: Reopen
        │
        └───► OPEN
```

## Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| **3.1** - New requests start as "open" | Enforced at creation time in controller |
| **3.2** - First response → "in_progress" | `autoTransitionOnFirstResponse()` method |
| **3.3** - Only Owner/Admin can fulfill | `transition()` authorization check |
| **3.4** - Only Owner/Admin can cancel | `transition()` authorization check |
| **3.5** - Auto-expire when date passes | `checkAutoExpiration()` method |
| **3.6** - Expired can be reopened | `EXPIRED → OPEN` transition allowed |
| **3.7** - Only Owner/Admin can change status | `isAuthorized()` private method |
| **3.8** - Fulfilled is terminal | `VALID_TRANSITIONS[FULFILLED] = []` |
| **3.9** - Cancelled terminal (admin override) | Special admin privilege in `isValidTransition()` |

## API Reference

### Core Methods

#### `transition(request, targetStatus, actor)`

Attempt a state transition with authorization and validation.

**Parameters:**
- `request: BloodRequest` - The blood request to transition
- `targetStatus: RequestStatus` - Desired new status
- `actor: StateTransitionActor` - User attempting transition (id + role)

**Returns:** `StateTransitionResult`
```typescript
{
  allowed: boolean;
  newStatus?: RequestStatus;  // Present if allowed
  error?: AppError;           // Present if not allowed
}
```

**Example:**
```typescript
import { requestStateMachine } from './services';

const result = requestStateMachine.transition(
  request,
  RequestStatus.FULFILLED,
  { id: userId, role: 'user' }
);

if (!result.allowed) {
  throw result.error;
}

// Update database with result.newStatus
await updateRequest(request._id, { status: result.newStatus });
```

#### `autoTransitionOnFirstResponse(request)`

Check if request should auto-transition to IN_PROGRESS when first response is received.

**Parameters:**
- `request: BloodRequest` - The blood request

**Returns:**
```typescript
{
  shouldTransition: boolean;
  newStatus?: RequestStatus;  // RequestStatus.IN_PROGRESS if shouldTransition
}
```

**Usage Pattern:**
```typescript
// In POST /api/requests/:id/respond controller
const result = requestStateMachine.autoTransitionOnFirstResponse(request);

if (result.shouldTransition) {
  await updateRequest(request._id, { status: result.newStatus });
}
```

#### `checkAutoExpiration(request, currentDate?)`

Check if request should be auto-expired based on neededByDate.

**Parameters:**
- `request: BloodRequest` - The blood request to check
- `currentDate?: Date` - Optional current date for testing (defaults to now)

**Returns:**
```typescript
{
  shouldExpire: boolean;
  newStatus?: RequestStatus;  // RequestStatus.EXPIRED if shouldExpire
}
```

**Implementation Options:**

**Option A: Check on Read** (Recommended for MVP)
```typescript
// In GET /api/requests/:id controller
const request = await findRequest(id);
const expiryCheck = requestStateMachine.checkAutoExpiration(request);

if (expiryCheck.shouldExpire && request.status !== RequestStatus.EXPIRED) {
  // Auto-expire in real-time
  await updateRequest(id, { status: RequestStatus.EXPIRED });
  request.status = RequestStatus.EXPIRED;
}

return request;
```

**Option B: Scheduled Job** (Better for production)
```typescript
// In a scheduled job (e.g., every hour)
const activeRequests = await findRequests({
  status: { $in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] }
});

for (const request of activeRequests) {
  const check = requestStateMachine.checkAutoExpiration(request);
  if (check.shouldExpire) {
    await updateRequest(request._id, { status: RequestStatus.EXPIRED });
    // Trigger notification (Req 9.6)
  }
}
```

### Utility Methods

#### `getValidTransitions(currentStatus, actor)`

Get all valid target statuses from current status for an actor. Useful for UI.

**Returns:** `RequestStatus[]`

**Example:**
```typescript
const validActions = requestStateMachine.getValidTransitions(
  request.status,
  { id: userId, role: 'user' }
);
// Frontend can show only these as available buttons
```

#### `isTerminalStatus(status, isAdmin)`

Check if a status is terminal (cannot transition).

**Returns:** `boolean`

## Valid Transitions Matrix

| From \ To | OPEN | IN_PROGRESS | FULFILLED | CANCELLED | EXPIRED |
|-----------|------|-------------|-----------|-----------|---------|
| **OPEN** | ✓ | ✓ | ✗ | ✓ | ✓ |
| **IN_PROGRESS** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **FULFILLED** | ✗ | ✗ | ✓ | ✗ | ✗ |
| **CANCELLED** | ✓ᵃ | ✓ᵃ | ✓ᵃ | ✓ | ✗ |
| **EXPIRED** | ✓ | ✗ | ✗ | ✗ | ✓ |

ᵃ = Admin only

## Error Handling

All state machine errors are `AppError` instances with:

- **403 Forbidden** - Unauthorized user attempting transition
  ```typescript
  {
    code: "forbidden",
    message: "You do not have permission to change the status...",
    details: { requestId, currentStatus, targetStatus, actorId }
  }
  ```

- **422 Invalid State** - Invalid transition attempt
  ```typescript
  {
    code: "invalid_state",
    message: "Invalid state transition from 'open' to 'fulfilled'...",
    details: { requestId, currentStatus, targetStatus }
  }
  ```

## Controller Integration Pattern

### Standard Status Change Endpoint

```typescript
// PATCH /api/requests/:id/status
export const changeRequestStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status: targetStatus } = req.body;
  const sessionUser = req.sessionUser; // From requireAuth middleware

  // Fetch request
  const request = await findRequest(id);
  if (!request) {
    throw createNotFoundError('Request', id);
  }

  // Check auto-expiration first
  const expiryCheck = requestStateMachine.checkAutoExpiration(request);
  if (expiryCheck.shouldExpire) {
    request.status = RequestStatus.EXPIRED;
    await updateRequest(id, { status: RequestStatus.EXPIRED });
  }

  // Attempt transition
  const result = requestStateMachine.transition(
    request,
    targetStatus,
    { id: sessionUser.id, role: sessionUser.role }
  );

  if (!result.allowed) {
    throw result.error;
  }

  // Update database
  await updateRequest(id, {
    status: result.newStatus,
    updatedAt: new Date()
  });

  // Log admin action if admin acting on non-owned resource
  if (sessionUser.role === 'admin' && !request.userId.equals(sessionUser.id)) {
    await logAdminAction({
      adminId: sessionUser.id,
      action: AdminActionType.MODIFY_REQUEST,
      targetType: 'request',
      targetId: request._id,
      previousState: { status: request.status },
      newState: { status: result.newStatus }
    });
  }

  // Trigger notification (Req 9.5)
  await notificationService.notify(
    request.userId,
    NotificationType.REQUEST_STATUS_CHANGE,
    { requestId: id, newStatus: result.newStatus }
  );

  res.json({ status: result.newStatus });
});
```

### Response Creation with Auto-transition

```typescript
// POST /api/requests/:id/respond
export const respondToRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sessionUser = req.sessionUser;

  // ... eligibility checks, max responses check ...

  // Create response with status "offered"
  const response = await createResponse({
    requestId: id,
    userId: sessionUser.id,
    status: ResponseStatus.OFFERED
  });

  // Check if this is the first response → auto-transition
  const responseCount = await countResponses(id);
  if (responseCount === 1) {
    const autoTransition = requestStateMachine.autoTransitionOnFirstResponse(request);
    if (autoTransition.shouldTransition) {
      await updateRequest(id, { status: autoTransition.newStatus });
      
      // Trigger notification
      await notificationService.notify(
        request.userId,
        NotificationType.NEW_RESPONSE,
        { requestId: id, responderId: sessionUser.id }
      );
    }
  }

  res.status(201).json(response);
});
```

## Testing

Comprehensive test suite covers:
- ✅ All 9 requirement scenarios (3.1-3.9)
- ✅ Authorization matrix (owner/admin/other)
- ✅ Valid transition paths
- ✅ Invalid transition blocking
- ✅ Terminal state enforcement
- ✅ Auto-transition logic
- ✅ Auto-expiration logic
- ✅ Error message clarity
- ✅ Utility method correctness

Run tests:
```bash
npm test -- requestStateMachine.service.test.ts
```

## Design Notes

### Why Not Use a Library?

This is a simple, domain-specific state machine with:
- 5 states
- ~10 transitions
- Clear business rules

A library (XState, etc.) would add complexity without benefit. Our implementation:
- ✅ Is fully typed
- ✅ Has zero dependencies
- ✅ Is easy to understand and modify
- ✅ Has comprehensive tests
- ✅ Follows BloodOS error handling patterns

### Extension Points

To add a new status or transition:

1. Add to `RequestStatus` enum in `types/shared.ts`
2. Update `VALID_TRANSITIONS` map
3. Add transition rules in `isValidTransition()`
4. Update error messages in `getTransitionErrorMessage()`
5. Add test cases
6. Update this README's diagram and matrix

## Related Services

- **Notification Service** (4a) - Triggers notifications on status changes
- **Admin Action Log** (4b) - Logs admin overrides
- **Request State Machine** (this) - Enforces transition rules

## Future Enhancements

### Phase 5+ Integration
- [ ] Scheduled job for batch auto-expiration
- [ ] Audit trail for all status changes
- [ ] Webhook support for external integrations
- [ ] Request expiry notifications 24h before (Req 9.6)

---

**Document Version:** 1.0  
**Last Updated:** Implementation of Phase 3, Unit 3b  
**Maintainer:** BloodOS Backend Team
