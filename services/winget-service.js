// ═══════════════════════════════════════════════════════
// Winget Service — version checking via GitHub API + winget CLI
// ═══════════════════════════════════════════════════════

const https = require('https');
const { exec } = require('child_process');
const { WINGET_CATALOG, ODT_PRODUCTS, ODT_APPS, ODT_LANGUAGES, ODT_CHANNELS } = require('./winget-catalog');

// ── GitHub releases/latest → parse tag_name ──────────────
function checkVersionGitHub(repo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases/latest`,
      headers: {
        'User-Agent': 'AppDeployManager/1.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 8000
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // tag_name is usually "v1.2.3" or "1.2.3"
          const raw = json.tag_name || json.name || '';
          const ver = raw.replace(/^[vV]/, '').split('-')[0].trim();
          resolve(ver || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Winget CLI → winget show --id X, parse "Version:" line ──
function checkVersionWinget(wingetId) {
  return new Promise((resolve) => {
    const cmd = `winget show --id "${wingetId}" --source winget --accept-source-agreements 2>nul`;
    exec(cmd, { timeout: 15000, shell: 'cmd.exe' }, (err, stdout) => {
      if (err || !stdout) { resolve(null); return; }
      const match = stdout.match(/Version\s*:\s*([^\r\n]+)/i);
      if (match) {
        resolve(match[1].trim() || null);
      } else {
        resolve(null);
      }
    });
  });
}

const wingetService = {
  getCatalog() {
    return {
      catalog: WINGET_CATALOG,
      odtProducts: ODT_PRODUCTS,
      odtApps: ODT_APPS,
      odtLanguages: ODT_LANGUAGES,
      odtChannels: ODT_CHANNELS
    };
  },

  // Check latest versions for an array of catalog ids.
  // Returns [{ id, wingetId, latestVersion }]
  async checkVersions(catalogIds) {
    const items = catalogIds
      .map(id => WINGET_CATALOG.find(a => a.id === id))
      .filter(Boolean);

    const results = await Promise.allSettled(
      items.map(async (item) => {
        let latestVersion = null;
        try {
          if (item.versionCheck.method === 'github') {
            latestVersion = await checkVersionGitHub(item.versionCheck.repo);
          } else if (item.versionCheck.method === 'winget') {
            latestVersion = await checkVersionWinget(item.wingetId);
          }
        } catch { /* ignore individual failures */ }
        return { id: item.id, wingetId: item.wingetId, latestVersion: latestVersion || item.defaultVersion };
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }
};

module.exports = wingetService;
