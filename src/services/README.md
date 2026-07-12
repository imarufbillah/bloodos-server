# BloodOS Services

This directory contains core business logic services for the BloodOS platform.

## Eligibility Service

### Overview

The `eligibility.service.ts` implements donor eligibility evaluation based on Bangladesh Red Crescent standards (Requirements 2.1-2.8).

### Business Rules

1. **Age Requirement** (Req 2.1, 2.5)
   - Minimum age: 18 years
   - Maximum age: 60 years
   - Both inclusive

2. **Weight Requirement** (Req 2.2, 2.6)
   - Minimum weight: 50kg

3. **Cooldown Period** (Req 2.3, 2.7)
   - Minimum 90 days between donations
   - Based on Bangladesh Red Crescent standards
   - Only enforced if `lastDonationDate` is present

4. **Blood Type Compatibility** (Req 2.4, 2.8)
   - Uses standard blood compatibility matrix
   - See compatibility matrix below

### Usage

```typescript
import { evaluateEligibility } from "./services/eligibility.service.js";
import { BloodGroup } from "./types/shared.js";

// Check if donor is eligible
const result = evaluateEligibility({
  donor: {
    bloodGroup: BloodGroup.O_NEGATIVE,
    lastDonationDate: new Date("2024-01-01"),
    isDonor: true,
    age: 25,
    weight: 60,
  },
  requestedBloodGroup: BloodGroup.A_POSITIVE,
});

if (result.eligible) {
  console.log("Donor is eligible!");
} else {
  console.log(`Ineligible: ${result.reason}`);
  if (result.daysRemaining) {
    console.log(`Days remaining: ${result.daysRemaining}`);
  }
}
```

### API

#### `evaluateEligibility(input: EligibilityCheckInput): EligibilityResult`

Evaluates donor eligibility against a blood request.

**Parameters:**
- `input.donor` - Donor information
  - `bloodGroup` - Required
  - `lastDonationDate` - Optional (null if never donated)
  - `isDonor` - Required
  - `age` - Optional (if provided, will be checked)
  - `weight` - Optional (if provided, will be checked)
- `input.requestedBloodGroup` - Blood group needed for the request

**Returns:**
- `eligible: boolean` - Whether donor can donate
- `reason?: IneligibilityReason` - Reason for ineligibility (if not eligible)
- `daysRemaining?: number` - Days remaining in cooldown (if cooldown failure)

**Ineligibility Reasons:**
- `"age_requirement"` - Age not in 18-60 range
- `"weight_requirement"` - Weight below 50kg
- `"cooldown_requirement"` - Less than 90 days since last donation
- `"blood_type_incompatible"` - Blood types not compatible

#### `calculateCooldownDaysRemaining(lastDonationDate: Date | null): number`

Calculates days remaining until donor becomes eligible again.

**Returns:** Number of days remaining (0 if eligible or never donated)

#### `getIneligibilityMessage(reason: IneligibilityReason, daysRemaining?: number): string`

Gets human-readable error message for an ineligibility reason.

### Check Order

Checks are performed in this order (returns first failure):
1. Age requirement
2. Weight requirement
3. Cooldown requirement
4. Blood type compatibility

This ensures consistent error reporting when multiple conditions fail.

---

## Compatibility Service

### Overview

The `compatibility.ts` provides blood type compatibility utilities using the standard compatibility matrix.

### Blood Compatibility Matrix

#### Recipient → Compatible Donors

- **A+** ← A+, A-, O+, O-
- **A-** ← A-, O-
- **B+** ← B+, B-, O+, O-
- **B-** ← B-, O-
- **AB+** ← All types (Universal Receiver)
- **AB-** ← A-, B-, AB-, O-
- **O+** ← O+, O-
- **O-** ← O- only

#### Donor → Compatible Recipients

- **O-** → All types (Universal Donor)
- **O+** → O+, A+, B+, AB+
- **A-** → A-, A+, AB-, AB+
- **A+** → A+, AB+
- **B-** → B-, B+, AB-, AB+
- **B+** → B+, AB+
- **AB-** → AB-, AB+
- **AB+** → AB+ only

### Usage

```typescript
import {
  isBloodTypeCompatible,
  getCompatibleDonors,
  getCompatibleRecipients,
} from "./services/compatibility.js";
import { BloodGroup } from "./types/shared.js";

// Check if donor can donate to recipient
const canDonate = isBloodTypeCompatible(
  BloodGroup.O_NEGATIVE, // donor
  BloodGroup.A_POSITIVE  // recipient
); // true - O- is universal donor

// Get all compatible donors for a blood type
const donors = getCompatibleDonors(BloodGroup.A_POSITIVE);
// Returns: [A+, A-, O+, O-]

// Get all compatible recipients for a donor
const recipients = getCompatibleRecipients(BloodGroup.O_NEGATIVE);
// Returns: All 8 blood types (universal donor)
```

### API

#### `isBloodTypeCompatible(donorBloodGroup: BloodGroup, recipientBloodGroup: BloodGroup): boolean`

Checks if a donor's blood group is compatible with a recipient's blood group.

**Parameters:**
- `donorBloodGroup` - Blood group of the potential donor
- `recipientBloodGroup` - Blood group needed for the request

**Returns:** `true` if compatible, `false` otherwise

#### `getCompatibleDonors(recipientBloodGroup: BloodGroup): BloodGroup[]`

Gets all blood groups that can donate to a specific blood group.

**Returns:** Array of compatible donor blood groups

#### `getCompatibleRecipients(donorBloodGroup: BloodGroup): BloodGroup[]`

Gets all blood groups that a specific blood group can donate to.

**Returns:** Array of compatible recipient blood groups

---

## Testing

All services have comprehensive test coverage validating:
- All requirements (2.1-2.8)
- Edge cases (boundary values, null handling)
- Full compatibility matrix
- Error messages and reasons

Run tests:
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

## Constants

### Eligibility Constants

```typescript
import { ELIGIBILITY_CONSTANTS } from "./services/eligibility.service.js";

console.log(ELIGIBILITY_CONSTANTS.MIN_AGE);        // 18
console.log(ELIGIBILITY_CONSTANTS.MAX_AGE);        // 60
console.log(ELIGIBILITY_CONSTANTS.MIN_WEIGHT_KG);  // 50
console.log(ELIGIBILITY_CONSTANTS.COOLDOWN_DAYS);  // 90
```

### Blood Compatibility

```typescript
import { BLOOD_COMPATIBILITY } from "./types/shared.js";

// Full compatibility matrix
const compatibleDonors = BLOOD_COMPATIBILITY[BloodGroup.A_POSITIVE];
// Returns: [A+, A-, O+, O-]
```

---

## Integration with Other Services

### Request Response Flow (Phase 5b)

When a donor responds to a request:

```typescript
// 1. Check eligibility
const eligibilityResult = evaluateEligibility({
  donor: currentUser,
  requestedBloodGroup: request.bloodGroup,
});

if (!eligibilityResult.eligible) {
  throw new AppError(
    getIneligibilityMessage(eligibilityResult.reason, eligibilityResult.daysRemaining),
    400,
    "ineligible_donor"
  );
}

// 2. Create response (if eligible)
// ... response creation logic
```

### Notification Service (Phase 4a)

Finding eligible donors for new requests:

```typescript
import { getCompatibleDonors } from "./services/compatibility.js";

// Find donors by blood compatibility and district
const compatibleBloodTypes = getCompatibleDonors(request.bloodGroup);

const eligibleDonors = await usersCollection.find({
  bloodGroup: { $in: compatibleBloodTypes },
  district: request.district,
  isDonor: true,
}).toArray();

// Then evaluate detailed eligibility for each donor
```

---

## Notes

1. **Age and Weight are Optional**: The eligibility service accepts optional `age` and `weight` fields. If not provided, those checks are skipped. This allows flexibility in the user model while maintaining strict checks when data is available.

2. **Cooldown Only When Applicable**: The cooldown check only applies if `lastDonationDate` is present. A donor who has never donated before (null date) will not be rejected due to cooldown.

3. **Check Order Matters**: The service checks eligibility in a specific order (age → weight → cooldown → compatibility). This ensures consistent error messages when multiple conditions fail simultaneously.

4. **Thread-Safe**: All functions are pure and stateless, safe for concurrent use.

5. **Type-Safe**: Full TypeScript typing ensures compile-time safety when integrating with other modules.
