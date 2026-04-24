// ═══════════════════════════════════════════════════════════
// Encrypted storage for secrets (API keys, share HMAC keys).
// Uses Electron's safeStorage which wraps DPAPI on Windows —
// encryption bound to the Windows user account.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

function getSecretsDir() {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'secrets');
}

function ensureDir() {
  const dir = getSecretsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function secretFile(name) {
  const safe = String(name).replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(ensureDir(), `${safe}.bin`);
}

const secretStore = {
  available() {
    try {
      const { safeStorage } = require('electron');
      return safeStorage.isEncryptionAvailable();
    } catch { return false; }
  },

  set(name, value) {
    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safe_storage_unavailable');
    }
    const enc = safeStorage.encryptString(String(value));
    fs.writeFileSync(secretFile(name), enc);
  },

  get(name) {
    const file = secretFile(name);
    if (!fs.existsSync(file)) return null;
    const { safeStorage } = require('electron');
    try { return safeStorage.decryptString(fs.readFileSync(file)); }
    catch { return null; }
  },

  delete(name) {
    const file = secretFile(name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
};

module.exports = secretStore;
