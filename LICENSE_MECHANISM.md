# ZoomInfo & Google Info Licensing Mechanism Documentation

This document provides a comprehensive technical overview of the licensing, machine-binding, and security enforcement system implemented across **Premium Google Info Search** and **ZoomInfo** extensions.

---

## 1. System Architecture

The licensing mechanism is an **unauthenticated client-to-cloud security architecture** powered by the **LicensePanel** PostgreSQL/Node.js backend service hosted at `https://node.justfinejob.store`. It validates licenses and binds machine installations directly via dedicated activation and heartbeat check endpoints without bundling sensitive administrative credentials into the client extension.

```
┌────────────────────────────────────────────────────────┐
│                   Chrome Extension                     │
│                                                        │
│   ┌─────────────────────┐   ┌──────────────────────┐   │
│   │   popup/popup.js    │   │  src/background.js   │   │
│   │  (Lock & Status UI) │   │ (Search Gate & Alarm)│   │
│   └──────────┬──────────┘   └──────────┬───────────┘   │
│              │                         │               │
│              └────────────┬────────────┘               │
│                           ▼                            │
│              ┌─────────────────────────┐               │
│              │  src/license-client.js  │               │
│              │   src/machine-id.js     │               │
│              └────────────┬────────────┘               │
└───────────────────────────┼────────────────────────────┘
                            │ HTTPS POST
                            ▼
     ┌──────────────────────────────────────────────┐
     │           LicensePanel Backend API           │
     │        https://node.justfinejob.store        │
     │      POST /api/licensing/check               │
     │      POST /api/licensing/activate            │
     └──────────────────────────────────────────────┘
```

---

## 2. Key Format Specification

License keys must conform to the following pattern:

- **Format:** `ZIM-` followed by exactly 32 alphanumeric characters.
- **Regex:** `/^ZIM-[A-Za-z0-9]{32}$/`
- **Example:** `ZIM-a1b2c3d4e5f678901234567890abcdef`

Keys that do not match this format are rejected client-side immediately without making a network request.

---

## 3. Firebase Database Schema

License records are stored under the `/licenses` root node in Firebase Realtime Database:

```json
{
  "licenses": {
    "ZIM-a1b2c3d4e5f678901234567890abcdef": {
      "status": "active",
      "seats": 1,
      "expiresAt": 1799884800000,
      "createdAt": 1769884800000,
      "note": "Client Production License",
      "machineIds": {
        "8f2b3e41-9a72-4d1c-b5f6-3e8a1d2c4e5f": 1769885000000
      }
    }
  }
}
```

### Field Definitions

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | `"active"` allows usage; `"inactive"` administratively revokes access. |
| `seats` | `number` | Maximum allowed unique machines bound to this key (default: `1`). |
| `expiresAt` | `number` \| `null` | Unix epoch timestamp in milliseconds. If `null`, license does not expire. |
| `createdAt` | `number` | Unix epoch timestamp when license was generated. |
| `machineIds` | `object` | Map of bound machine IDs as keys, and epoch timestamps of binding as values. |
| `note` | `string` | Optional administrative description or client identifier. |

---

## 4. Machine Fingerprinting (`machine-id.js`)

Each extension install generates a unique, persistent client UUID:

1. **Generation:** Uses `crypto.randomUUID()` (with RFC4122 v4 fallback).
2. **Storage:** Cached in `chrome.storage.local` under the key `'machineId'`.
3. **Persistence:** Survives browser restarts and extension updates.
4. **Hardware Binding:** On first license activation, this machine ID is registered in the license's `machineIds` node on Firebase.

---

## 5. License Validation Workflow (`license-client.js`)

When a license key is activated or re-checked:

```
[User Enters Key]
       │
       ▼
1. Format Check (Regex /^ZIM-[A-Za-z0-9]{32}$/)
       │ Valid
       ▼
2. Fetch /licenses/<KEY>.json via HTTPS
       │
       ├──> Record is null/empty ─────────────> [Error: 'not_found']
       ├──> status === 'inactive' ────────────> [Error: 'inactive']
       ├──> expiresAt < Date.now() ───────────> [Error: 'expired']
       │
       ▼
3. Check Machine Bindings
       ├──> Machine ID already in machineIds ──> [Result: OK (alreadyBound)]
       ├──> Bound machines >= seats ──────────> [Error: 'seat_limit_reached']
       │
       ▼
4. Claim Seat
       PUT /licenses/<KEY>/machineIds/<MACHINE_ID>.json = Date.now()
       │
       ▼
5. Persist State in chrome.storage.local
       ├── licenseKey: "ZIM-..."
       ├── licenseState: { ok: true, reason: 'ok', key, machineId, expiresAt }
       └── licenseLastCheckedAt: Date.now()
```

---

## 6. Security Enforcement in `background.js`

### 1. Pre-Execution Search Gate
Before any single or bulk search is initiated, `searchAll` executes:

```javascript
const secState = await getSecurityState();
if (!secState || !secState.isActive || secState.needsLicense) {
  const reason = secState?.licenseState?.reason || 'unlicensed';
  throw new Error(`Search blocked: Valid ZoomInfo license required (${reason}). Please activate your license.`);
}
```

### 2. Dual-Heartbeat Re-Validation
The extension continuously verifies license validity in the background:
- **30-Second Interval:** `setInterval(fetchConfigAndValidate, 30000)` checks license state in memory.
- **1-Minute Alarm:** `chrome.alarms` listener (`license_heartbeat`) ensures checks continue even if the service worker sleeps.
- If an admin marks the license `inactive` or it expires during an active search, `stopSearch()` is immediately called and the UI is locked.

---

## 7. UI Components & States (`popup/popup.js` & `popup.html`)

### 1. Active License Banner (`#licenseStatusBanner`)
- Displayed at the top of the extension when the license is valid.
- Shows expiration countdown if less than 7 days remain (`• Expires in Xd`).
- Displays expiration date in tooltip.

### 2. Lock Activation Overlay (`#lockOverlay`)
- Displayed when no license is found or during initial setup.
- Provides input for the `ZIM-...` key and an **Activate Extension** button.
- Displays **This machine's ID** so users can share it with administrators for manual pre-binding if required.

### 3. Deactivated / Expired Overlay (`#licenseInvalidOverlay`)
- Displayed when a previously active license becomes expired or revoked by admin.
- Prevents interaction with search and export features.
- Provides an **Enter New Key** button which clears stored keys and returns to activation mode.

---

## 8. Administrator Management Guide

### Creating a New License
In Firebase Console, navigate to `/licenses` and add a new node:

```json
"ZIM-ABCDEF1234567890ABCDEF1234567890": {
  "status": "active",
  "seats": 1,
  "expiresAt": 1799884800000,
  "createdAt": 1769884800000,
  "note": "Storyteller Overland Project"
}
```

### Increasing Allowed Machines (Multi-Seat)
Change `"seats": 1` to `"seats": 3`. Up to 3 unique machines can now bind to this single key.

### Resetting / Moving a License to a New PC
If a user replaces their PC or reinstalls Chrome:
1. Locate the license key under `/licenses/<KEY>`.
2. Delete the old UUID entry inside the `machineIds` node.
3. The user can now activate the key on their new machine.

### Revoking a License Immediately
Change `"status": "active"` to `"status": "inactive"`. Within 30 seconds, all connected extensions using that key will lock down automatically.
