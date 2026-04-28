const fs = require('fs');
const path = require('path');
const os = require('os');

function getUserDataDir() {
  try {
    const { app } = require('electron');
    return app?.getPath ? app.getPath('userData') : os.tmpdir();
  } catch {
    return os.tmpdir();
  }
}

function getConfiguredLogDir() {
  try {
    const configService = require('./config');
    const cfg = configService.getConfig();
    return typeof cfg.logDirectory === 'string' && cfg.logDirectory.trim()
      ? cfg.logDirectory.trim()
      : '';
  } catch {
    return '';
  }
}

function getLogPath() {
  const configuredDir = getConfiguredLogDir();
  return path.join(configuredDir || getUserDataDir(), 'activity-log.json');
}

function ensureLogDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseEntries(raw) {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function loadLog() {
  try {
    const p = getLogPath();
    if (fs.existsSync(p)) {
      return parseEntries(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading activity log:', err);
  }
  return [];
}

function saveLog(entries) {
  // Keep max 500 entries to avoid file bloat
  const trimmed = entries.slice(-500);
  const target = getLogPath();
  try {
    ensureLogDir(target);
    fs.writeFileSync(target, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    const fallback = path.join(getUserDataDir(), 'activity-log.json');
    if (fallback === target) throw err;
    console.warn('Error writing configured activity log path, falling back:', err.message);
    ensureLogDir(fallback);
    fs.writeFileSync(fallback, JSON.stringify(trimmed, null, 2), 'utf-8');
  }
}

const activityLog = {
  getAll() {
    return loadLog();
  },

  getRecent(count = 15) {
    const log = loadLog();
    return log.slice(-count).reverse();
  },

  add(action, details = {}) {
    const log = loadLog();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      action,
      ...details
    };
    log.push(entry);
    saveLog(log);
    return entry;
  },

  clear() {
    saveLog([]);
    return { success: true };
  },

  getPath() {
    return getLogPath();
  }
};

module.exports = activityLog;
