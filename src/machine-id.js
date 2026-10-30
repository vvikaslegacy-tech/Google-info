const STORAGE_KEY = 'machineId';

let cachedId = null;

export async function getMachineId() {
  if (cachedId) return cachedId;
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  if (data[STORAGE_KEY]) {
    cachedId = data[STORAGE_KEY];
    return cachedId;
  }

  cachedId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : fallbackUuid();

  await chrome.storage.local.set({ [STORAGE_KEY]: cachedId });
  return cachedId;
}

function fallbackUuid() {
  const bytes = new Uint8Array(16);
  (crypto && crypto.getRandomValues ? crypto : { getRandomValues: (b) => {
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }}).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;  // RFC4122 version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
