const fs = require('fs');
const path = require('path');
const configService = require('./config');

const fileService = {
  listDeployedApps() {
    try {
      const config = configService.getConfig();
      const basePath = config.networkSharePath;

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

          return {
            name: dir.name,
            path: dirPath,
            files,
            hasScript,
            hasInstaller,
            version: manifest?.version || null,
            hash: manifest?.hash || null,
            deployedAt: manifest?.deployedAt || null,
            status: hasScript && hasInstaller ? 'ready' : hasScript ? 'missing-installer' : 'missing-script'
          };
        });

      return { success: true, data: apps };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  getAppContents(name) {
    try {
      const config = configService.getConfig();
      const dirPath = path.join(config.networkSharePath, name);

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
      const dirPath = path.join(config.networkSharePath, name);

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
