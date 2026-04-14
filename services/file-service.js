const fs = require('fs');
const path = require('path');
const configService = require('./config');

const fileService = {
  listDeployedApps() {
    try {
      const config = configService.getConfig();
      const basePath = config.networkSharePath;
      const myShareId = config.shareId || '';

      if (!fs.existsSync(basePath)) {
        return { success: false, error: `La ruta no existe: ${basePath}`, data: [] };
      }

      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      const apps = entries
        .filter(e => e.isDirectory())
        .map(dir => {
          const dirPath = path.join(basePath, dir.name);
          const files = fs.readdirSync(dirPath).map(f => {
            const filePath = path.join(dirPath, f);
            const stats = fs.statSync(filePath);
            return {
              name: f,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              extension: path.extname(f).toLowerCase()
            };
          });

          const hasScript = files.some(f => f.extension === '.ps1');
          const hasInstaller = files.some(f => f.extension === '.msi' || f.extension === '.exe');

          // Read version manifest if available
          let manifest = null;
          const versionFile = path.join(dirPath, 'version.json');
          try {
            if (fs.existsSync(versionFile)) {
              manifest = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
            }
          } catch (e) {}

          // If config has a shareId, only include folders that match it
          // (folders without shareId in manifest are always included for backward compat)
          if (myShareId && manifest?.shareId && manifest.shareId !== myShareId) {
            return null;
          }

          return {
            name: dir.name,
            path: dirPath,
            files,
            hasScript,
            hasInstaller,
            version: manifest?.version || null,
            hash: manifest?.hash || null,
            deployedAt: manifest?.deployedAt || null,
            shareId: manifest?.shareId || null,
            status: hasScript && hasInstaller ? 'ready' : hasScript ? 'missing-installer' : 'missing-script'
          };
        }).filter(Boolean);

      return { success: true, data: apps };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  getAppContents(name) {
    try {
      const config = configService.getConfig();
      const safeName = (name || '').replace(/[^a-zA-Z0-9\s\-_.]/g, '').substring(0, 128);
      if (!safeName || safeName !== name) {
        return { success: false, error: 'Invalid folder name', data: [] };
      }
      const dirPath = path.normalize(path.join(config.networkSharePath, safeName));
      if (!dirPath.startsWith(path.normalize(config.networkSharePath))) {
        return { success: false, error: 'Path traversal detected', data: [] };
      }

      if (!fs.existsSync(dirPath)) {
        return { success: false, error: 'Carpeta no encontrada', data: [] };
      }

      const files = fs.readdirSync(dirPath).map(f => {
        const filePath = path.join(dirPath, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: path.extname(f).toLowerCase()
        };
      });

      return { success: true, data: files };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  createAppFolder(name) {
    try {
      const config = configService.getConfig();
      const safeName = (name || '').replace(/[^a-zA-Z0-9\s\-_.]/g, '').substring(0, 128);
      if (!safeName || safeName !== name) {
        return { success: false, error: 'Invalid folder name' };
      }
      const dirPath = path.normalize(path.join(config.networkSharePath, safeName));
      if (!dirPath.startsWith(path.normalize(config.networkSharePath))) {
        return { success: false, error: 'Path traversal detected' };
      }

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      return { success: true, path: dirPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = fileService;
