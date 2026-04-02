const fs = require('fs');
const path = require('path');

let configFilePath = null;

function getConfigPath() {
  if (!configFilePath) {
    const { app } = require('electron');
    configFilePath = path.join(app.getPath('userData'), 'config.json');
  }
  return configFilePath;
}

const DEFAULT_CONFIG = {
  networkSharePath: '\\\\SERVER\\share\\apps',
  logDirectory: 'C:\\ProgramData\\Maqueta_Logs',
  defaultGPO: '',
  language: 'es',
  firstRun: true
};

const configService = {
  getConfig() {
    try {
      const cfgPath = getConfigPath();
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('Error reading config:', err);
    }
    return { ...DEFAULT_CONFIG };
  },

  setConfig(data) {
    try {
      const current = this.getConfig();
      const merged = { ...current, ...data, firstRun: false };
      fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
      return { success: true, data: merged };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = configService;
