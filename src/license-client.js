import { getMachineId } from './machine-id.js';

const LICENSE_API_URL = 'https://node.justfinejob.store';
const KEY_RE = /^ZIM-[A-Za-z0-9]{32}$/;

// Storage keys
const LICENSE_STORAGE = {
  KEY:           'licenseKey',
  STATE:         'licenseState',         // { ok, reason, key, machineId, checkedAt, expiresAt }
  LAST_CHECK_AT: 'licenseLastCheckedAt'
};

export function isValidKeyFormat(key) {
  return typeof key === 'string' && KEY_RE.test(key.trim());
}

/**
 * Call the LicensePanel check API (read-only, never activates).
 * POST /api/licensing/check { licenseKey, machineId }
 * Returns { status, valid, message, license }
 */
async function checkLicense(key, machineId) {
  const res = await fetch(`${LICENSE_API_URL}/api/licensing/check`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ licenseKey: key, machineId })
  });
  if (!res.ok) {
    throw new Error(`License server responded ${res.status}`);
  }
  return await res.json();
}

/**
 * Call the LicensePanel activate API (binds machine on first call, idempotent).
 * POST /api/licensing/activate { licenseKey, machineId }
 * Returns { status, valid, message, license }
 */
async function activateLicense(key, machineId) {
  const res = await fetch(`${LICENSE_API_URL}/api/licensing/activate`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ licenseKey: key, machineId })
  });
  if (!res.ok) {
    throw new Error(`License server responded ${res.status}`);
  }
  return await res.json();
}

/**
 * Map a LicensePanel API status to our internal reason code.
 */
function mapStatusToReason(status) {
  const mapping = {
    'active': 'ok',
    'not_activated': 'not_activated',
    'disabled': 'inactive',
    'expired': 'expired',
    'activation_limit_reached': 'seat_limit_reached',
    'not_found': 'not_found'
  };
  return mapping[status] || status;
}

/**
 * Convert a LicensePanel expiry date (YYYY-MM-DD) to epoch ms (end of that day UTC).
 */
function expiryDateToMs(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999Z`);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

export async function validateLicense(key, { machineId } = {}) {
  const cleanKey = String(key || '').trim();
  if (!isValidKeyFormat(cleanKey)) {
    return { ok: false, reason: 'invalid_format', key: cleanKey };
  }

  const myMachineId = machineId || await getMachineId();

  let data;
  try {
    data = await checkLicense(cleanKey, myMachineId);
  } catch (err) {
    return { ok: false, reason: 'network_error', error: err.message, key: cleanKey };
  }

  const reason = mapStatusToReason(data.status);
  const expiresAt = data.license ? expiryDateToMs(data.license.expiryDate) : null;

  if (data.valid) {
    // License is active and this machine is already bound
    return {
      ok: true,
      reason: 'ok',
      key: cleanKey,
      machineId: myMachineId,
      alreadyBound: true,
      row: { expiresAt, seats: data.license?.activationLimit || 1 }
    };
  }

  if (data.status === 'not_activated') {
    // Key is valid but this machine hasn't been activated yet — still OK to proceed
    return {
      ok: true,
      reason: 'ok',
      key: cleanKey,
      machineId: myMachineId,
      alreadyBound: false,
      row: { expiresAt, seats: data.license?.activationLimit || 1 }
    };
  }

  // All other statuses are failures
  return {
    ok: false,
    reason,
    key: cleanKey,
    row: { expiresAt, seats: data.license?.activationLimit || 1 }
  };
}

export async function bindMachineId(key, machineId) {
  const cleanKey = String(key || '').trim();
  if (!isValidKeyFormat(cleanKey)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const myMachineId = machineId || await getMachineId();

  let data;
  try {
    data = await activateLicense(cleanKey, myMachineId);
  } catch (err) {
    return { ok: false, reason: 'bind_failed', error: `License server responded: ${err.message}` };
  }

  if (data.valid) {
    return { ok: true, machineId: myMachineId, activatedAt: Date.now() };
  }

  const reason = mapStatusToReason(data.status);
  return {
    ok: false,
    reason,
    error: data.message || 'Activation failed.'
  };
}

export async function persistLicenseState(state) {
  const snapshot = {
    ok:        !!state.ok,
    reason:    state.reason || (state.ok ? 'ok' : 'unknown'),
    key:       state.key || null,
    machineId: state.machineId || null,
    expiresAt: state.expiresAt != null ? Number(state.expiresAt) : null,
    checkedAt: Date.now()
  };
  await chrome.storage.local.set({
    [LICENSE_STORAGE.STATE]:         snapshot,
    [LICENSE_STORAGE.LAST_CHECK_AT]: snapshot.checkedAt
  });
  return snapshot;
}

export async function readPersistedLicenseState() {
  const data = await chrome.storage.local.get([LICENSE_STORAGE.STATE, LICENSE_STORAGE.KEY]);
  return {
    storedKey:   data[LICENSE_STORAGE.KEY] || null,
    storedState: data[LICENSE_STORAGE.STATE] || null
  };
}

export async function saveLicenseKey(key) {
  await chrome.storage.local.set({ [LICENSE_STORAGE.KEY]: key });
}

export async function clearLicenseKey() {
  await chrome.storage.local.remove([
    LICENSE_STORAGE.KEY,
    LICENSE_STORAGE.STATE,
    LICENSE_STORAGE.LAST_CHECK_AT
  ]);
}

export { LICENSE_STORAGE, LICENSE_API_URL };
