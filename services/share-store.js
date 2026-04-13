// ═══════════════════════════════════════════════════════
// ShareBackedStore — eliminates duplicated getShareMetaPath /
// tryReadShare / tryWriteShare logic in app-service and bundle-service.
// Usage: const store = createShareStore('apps-config.json')
// ═══════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

function createShareStore(filename) {
  function getShareMetaPath() {
    try {
      const cfg = require('./config').getConfig();
      if (!cfg?.networkSharePath) return null;
      return path.join(cfg.networkSharePath, '.appdeploy-meta', filename);
    } catch { return null; }
  }

  return {
    read() {
      const sharePath = getShareMetaPath();
      if (!sharePath) return null;
      try {
        if (fs.existsSync(sharePath))
          return JSON.parse(fs.readFileSync(sharePath, 'utf-8'));
      } catch (err) {
        console.warn(`[share] Could not read ${filename}:`, err.message);
      }
      return null;
    },

    write(data) {
      const sharePath = getShareMetaPath();
      if (!sharePath) return false;
      try {
        const dir = path.dirname(sharePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(sharePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
      } catch (err) {
        console.warn(`[share] Could not write ${filename}:`, err.message);
        return false;
      }
    }
  };
}

module.exports = { createShareStore };
