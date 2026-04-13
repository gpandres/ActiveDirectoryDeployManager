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
  networkSharePath: '',
  logDirectory: 'C:\\ProgramData\\AppDeploy_Logs',
  defaultGPO: '',
  baseOU: '',
  language: 'es',
  firstRun: true
};

const DANGEROUS_KEYS = /^(__proto__|constructor|prototype)$/;

function sanitizeConfigData(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  for (const key of Object.keys(data)) {
    if (DANGEROUS_KEYS.test(key)) continue;
    sanitized[key] = data[key];
  }
  return sanitized;
}

const configService = {
  getConfig() {
    try {
      const cfgPath = getConfigPath();
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...sanitizeConfigData(parsed) };
      }
    } catch (err) {
      console.error('Error reading config:', err);
    }
    return { ...DEFAULT_CONFIG };
  },

  setConfig(data) {
    try {
      const current = this.getConfig();
      const safeData = sanitizeConfigData(data);
      const merged = { ...current, ...safeData, firstRun: false };
      fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
      return { success: true, data: merged };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = configService;
