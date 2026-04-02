const fs = require('fs');
const path = require('path');

let logFilePath = null;

function getLogPath() {
  if (!logFilePath) {
    const { app } = require('electron');
    logFilePath = path.join(app.getPath('userData'), 'activity-log.json');
  }
  return logFilePath;
}

function loadLog() {
  try {
    const p = getLogPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading activity log:', err);
  }
  return [];
}

function saveLog(entries) {
  // Keep max 500 entries to avoid file bloat
  const trimmed = entries.slice(-500);
  fs.writeFileSync(getLogPath(), JSON.stringify(trimmed, null, 2), 'utf-8');
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
  }
};

module.exports = activityLog;
