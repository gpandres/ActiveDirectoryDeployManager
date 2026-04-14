// ═══════════════════════════════════════════════════════
// Catalog Service — unified catalog, search & version checking
// Replaces: winget-catalog.js + winget-service.js
// ═══════════════════════════════════════════════════════

const https = require('https');
const { exec } = require('child_process');

// ─── Curated Catalog ────────────────────────────────────────
// versionCheck.method: 'github' | 'winget' | 'none'

const CURATED_CATALOG = [
  // ─── Browsers ─────────────────────────────────────────────
  {
    id: 'google-chrome', name: 'Google Chrome', wingetId: 'Google.Chrome',
    category: 'Browsers', icon: '🌐', defaultVersion: '126.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'firefox', name: 'Mozilla Firefox', wingetId: 'Mozilla.Firefox',
    category: 'Browsers', icon: '🦊', defaultVersion: '127.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'microsoft-edge', name: 'Microsoft Edge', wingetId: 'Microsoft.Edge',
    category: 'Browsers', icon: '🔵', defaultVersion: '126.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'brave', name: 'Brave Browser', wingetId: 'Brave.Brave',
    category: 'Browsers', icon: '🦁', defaultVersion: '1.67',
    versionCheck: { method: 'github', repo: 'brave/brave-browser' }
  },

  // ─── Herramientas ─────────────────────────────────────────
  {
    id: '7zip', name: '7-Zip', wingetId: '7zip.7zip',
    category: 'Tools', icon: '🗜️', defaultVersion: '24.08',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'notepadplusplus', name: 'Notepad++', wingetId: 'Notepad++.Notepad++',
    category: 'Tools', icon: '📝', defaultVersion: '8.6',
    versionCheck: { method: 'github', repo: 'notepad-plus-plus/notepad-plus-plus' }
  },
  {
    id: 'adobereader', name: 'Adobe Acrobat Reader', wingetId: 'Adobe.Acrobat.Reader.64-bit',
    category: 'Tools', icon: '📄', defaultVersion: '24.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'pdf24', name: 'PDF24 Creator', wingetId: 'geekSoftware.PDF24Creator',
    category: 'Tools', icon: '📋', defaultVersion: '11.20',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'greenshot', name: 'Greenshot', wingetId: 'Greenshot.Greenshot',
    category: 'Tools', icon: '📸', defaultVersion: '1.2.10',
    versionCheck: { method: 'github', repo: 'greenshot/greenshot' }
  },
  {
    id: 'sharex', name: 'ShareX', wingetId: 'ShareX.ShareX',
    category: 'Tools', icon: '🖼️', defaultVersion: '16.1',
    versionCheck: { method: 'github', repo: 'ShareX/ShareX' }
  },
  {
    id: 'paintnet', name: 'Paint.NET', wingetId: 'dotPDN.PaintDotNet',
    category: 'Tools', icon: '🎨', defaultVersion: '5.1',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'keepass', name: 'KeePass', wingetId: 'DominikReichl.KeePass',
    category: 'Tools', icon: '🔐', defaultVersion: '2.57',
    versionCheck: { method: 'winget' }
  },

  // ─── Conectividad ─────────────────────────────────────────
  {
    id: 'filezilla', name: 'FileZilla', wingetId: 'TimKosse.FileZilla.Client',
    category: 'Connectivity', icon: '📁', defaultVersion: '3.67',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'winscp', name: 'WinSCP', wingetId: 'WinSCP.WinSCP',
    category: 'Connectivity', icon: '🔒', defaultVersion: '6.3',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'putty', name: 'PuTTY', wingetId: 'PuTTY.PuTTY',
    category: 'Connectivity', icon: '🖥️', defaultVersion: '0.81',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'mremoteng', name: 'mRemoteNG', wingetId: 'mRemoteNG.mRemoteNG',
    category: 'Connectivity', icon: '🌐', defaultVersion: '1.77',
    versionCheck: { method: 'github', repo: 'mRemoteNG/mRemoteNG' }
  },
  {
    id: 'openvpn', name: 'OpenVPN', wingetId: 'OpenVPNTechnologies.OpenVPN',
    category: 'Connectivity', icon: '🔑', defaultVersion: '2.6',
    versionCheck: { method: 'winget' }
  },

  // ─── Comunicación ─────────────────────────────────────────
  {
    id: 'zoom', name: 'Zoom', wingetId: 'Zoom.Zoom',
    category: 'Communication', icon: '📹', defaultVersion: '6.1',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'teams', name: 'Microsoft Teams', wingetId: 'Microsoft.Teams',
    category: 'Communication', icon: '💬', defaultVersion: '24.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'slack', name: 'Slack', wingetId: 'SlackTechnologies.Slack',
    category: 'Communication', icon: '💜', defaultVersion: '4.39',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'discord', name: 'Discord', wingetId: 'Discord.Discord',
    category: 'Communication', icon: '🎮', defaultVersion: '1.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'whatsapp', name: 'WhatsApp', wingetId: 'WhatsApp.WhatsApp',
    category: 'Communication', icon: '📱', defaultVersion: '2.2',
    versionCheck: { method: 'winget' }
  },

  // ─── Multimedia ───────────────────────────────────────────
  {
    id: 'vlc', name: 'VLC Media Player', wingetId: 'VideoLAN.VLC',
    category: 'Multimedia', icon: '🎬', defaultVersion: '3.0.21',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'spotify', name: 'Spotify', wingetId: 'Spotify.Spotify',
    category: 'Multimedia', icon: '🎵', defaultVersion: '1.2',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'mpchc', name: 'MPC-HC', wingetId: 'clsid2.mpc-hc',
    category: 'Multimedia', icon: '▶️', defaultVersion: '2.3',
    versionCheck: { method: 'github', repo: 'clsid2/mpc-hc' }
  },

  // ─── Desarrollo ───────────────────────────────────────────
  {
    id: 'vscode', name: 'Visual Studio Code', wingetId: 'Microsoft.VisualStudioCode',
    category: 'Development', icon: '💻', defaultVersion: '1.91',
    versionCheck: { method: 'github', repo: 'microsoft/vscode' }
  },
  {
    id: 'git', name: 'Git', wingetId: 'Git.Git',
    category: 'Development', icon: '🔀', defaultVersion: '2.46',
    versionCheck: { method: 'github', repo: 'git-for-windows/git' }
  },
  {
    id: 'python', name: 'Python 3', wingetId: 'Python.Python.3.12',
    category: 'Development', icon: '🐍', defaultVersion: '3.12',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'nodejs', name: 'Node.js LTS', wingetId: 'OpenJS.NodeJS.LTS',
    category: 'Development', icon: '🟩', defaultVersion: '20.0',
    versionCheck: { method: 'winget' }
  },
];

// ─── Office (ODT) Data ──────────────────────────────────────
const ODT_PRODUCTS = [
  { id: 'O365BusinessRetail',   label: 'Microsoft 365 Business',    channel: 'MonthlyEnterprise', type: 'subscription' },
  { id: 'O365ProPlusRetail',    label: 'Microsoft 365 Apps',        channel: 'MonthlyEnterprise', type: 'subscription' },
  { id: 'ProPlus2021Volume',    label: 'Office LTSC 2021',          channel: 'PerpetualVL2021',   type: 'ltsc' },
  { id: 'ProPlus2019Volume',    label: 'Office LTSC 2019',          channel: 'PerpetualVL2019',   type: 'ltsc' },
];

const ODT_APPS = [
  { id: 'Word',      label: 'Word',        default: true },
  { id: 'Excel',     label: 'Excel',       default: true },
  { id: 'PowerPoint',label: 'PowerPoint',  default: true },
  { id: 'Outlook',    label: 'Outlook (Classic)', default: true },
  { id: 'OutlookNew', label: 'Outlook (New)',     default: false },
  { id: 'OneNote',   label: 'OneNote',     default: true },
  { id: 'Access',    label: 'Access',      default: false },
  { id: 'Publisher', label: 'Publisher',   default: false },
  { id: 'Teams',     label: 'Teams (addon)',default: false },
  { id: 'OneDrive',  label: 'OneDrive',    default: true },
];

const ODT_LANGUAGES = [
  { id: 'es-es', label: 'Español (España)' },
  { id: 'en-us', label: 'English (US)' },
  { id: 'fr-fr', label: 'Français' },
  { id: 'de-de', label: 'Deutsch' },
  { id: 'pt-pt', label: 'Português' },
  { id: 'it-it', label: 'Italiano' },
  { id: 'nl-nl', label: 'Nederlands' },
  { id: 'pl-pl', label: 'Polski' },
];

const ODT_CHANNELS = [
  { id: 'MonthlyEnterprise', label: 'Monthly Enterprise (recomendado)' },
  { id: 'Current',           label: 'Current Channel' },
  { id: 'SemiAnnual',        label: 'Semi-Annual Enterprise' },
];

// ─── Version Checking Helpers ───────────────────────────────

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

// ─── CLI Winget Search ───────────────────────────────────────
// Uses the local winget binary — stable, no external API dependency.

function searchWingetCLI(query) {
  return new Promise((resolve) => {
    if (!query || query.length < 2) { resolve([]); return; }

    // Sanitise: strip double-quotes to avoid shell injection
    const safeQuery = query.replace(/"/g, '');
    // Note: --disable-interactivity was added in winget 1.5 — omit for compatibility
    const cmd = `winget search --query "${safeQuery}" --source winget --accept-source-agreements 2>nul`;

    exec(cmd, { timeout: 25000, shell: 'cmd.exe' }, (_err, stdout) => {
      if (!stdout || !stdout.trim()) { resolve([]); return; }

      // Strip ANSI/VT escape sequences winget may emit
      const clean = stdout.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
      const lines = clean.split('\n').filter(l => l.trim());

      // Find the separator line (dashes or box-drawing chars)
      const sepIdx = lines.findIndex(l => /^[\-─]{3,}/.test(l.trim()));
      if (sepIdx < 1) { resolve([]); return; }

      // Parse data rows — use 2+ consecutive spaces as column separator (locale-independent)
      const results = lines.slice(sepIdx + 1)
        .map(line => {
          // Split by 2+ spaces; this splits "Name    Publisher.Id    1.0.0" correctly
          const cols = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
          if (cols.length < 2) return null;

          // Winget IDs always look like Publisher.AppName — find that column
          const idColIdx = cols.findIndex(c => /^[A-Za-z0-9][A-Za-z0-9.\-_]*\.[A-Za-z0-9][A-Za-z0-9.\-_]*$/.test(c));
          if (idColIdx < 0) return null;

          const wingetId = cols[idColIdx];
          const name     = cols.slice(0, idColIdx).join(' ').trim() || wingetId;
          const version  = cols[idColIdx + 1] || '';

          return {
            id: wingetId.toLowerCase().replace(/\./g, '-'),
            name,
            wingetId,
            version,
            category: 'Winget',
            icon: '📦',
            source: 'winget-cli'
          };
        })
        .filter(Boolean)
        .slice(0, 30);

      resolve(results);
    });
  });
}

// ─── Main Service ───────────────────────────────────────────

const catalogService = {
  /**
   * Returns the curated catalog + ODT data (for the app wizard and catalog page).
   * Backward-compatible with the old wingetService.getCatalog() shape.
   */
  getCatalog() {
    return {
      catalog: CURATED_CATALOG,
      odtProducts: ODT_PRODUCTS,
      odtApps: ODT_APPS,
      odtLanguages: ODT_LANGUAGES,
      odtChannels: ODT_CHANNELS
    };
  },

  /**
   * Search the catalog: first checks curated list, then queries the Winget API.
   * @param {string} query — search term
   * @param {string} category — 'Todo'|specific category name
   * @returns {Promise<Array>} results
   */
  async search(query, category) {
    const q = (query || '').toLowerCase().trim();
    const cat = category || 'Todo';

    // 1. Filter curated catalog
    let curated = CURATED_CATALOG.filter(item => {
      const matchCat = cat === 'Todo' || item.category === cat;
      const matchQ = !q
        || item.name.toLowerCase().includes(q)
        || item.wingetId.toLowerCase().includes(q)
        || item.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    }).map(item => ({ ...item, source: 'curated' }));

    // 2. If query is provided, also search via winget CLI for extended results
    let cliResults = [];
    if (q.length >= 2 && (cat === 'Todo' || cat === 'Winget')) {
      try {
        cliResults = await searchWingetCLI(q);
        // Remove duplicates already present in curated
        const curatedIds = new Set(curated.map(c => c.wingetId.toLowerCase()));
        cliResults = cliResults.filter(r => !curatedIds.has((r.wingetId || '').toLowerCase()));
      } catch { /* winget not available — return curated only */ }
    }

    return [...curated, ...cliResults];
  },

  /**
   * Check latest versions for an array of catalog item ids.
   * @param {string[]} catalogIds — array of catalog item .id values
   * @returns {Promise<Array<{id, wingetId, latestVersion}>>}
   */
  async checkVersions(catalogIds) {
    const items = (catalogIds || [])
      .map(id => CURATED_CATALOG.find(a => a.id === id))
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
        return {
          id: item.id,
          wingetId: item.wingetId,
          name: item.name,
          icon: item.icon,
          catalogVersion: item.defaultVersion,
          latestVersion: latestVersion || item.defaultVersion
        };
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  },

  /**
   * Direct CLI search — called from the catalog renderer for the second-phase
   * results that appear after the instant curated filter.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  searchCLI(query) {
    return searchWingetCLI(query);
  },

  /**
   * Check a single winget package version.
   * @param {string} wingetId
   * @returns {Promise<{wingetId, latestVersion}>}
   */
  async checkSingle(wingetId) {
    const item = CURATED_CATALOG.find(a => a.wingetId === wingetId);
    let latestVersion = null;
    
    if (item) {
      if (item.versionCheck.method === 'github') {
        latestVersion = await checkVersionGitHub(item.versionCheck.repo);
      } else {
        latestVersion = await checkVersionWinget(wingetId);
      }
    } else {
      // Not in curated list — use winget CLI directly
      latestVersion = await checkVersionWinget(wingetId);
    }

    return {
      wingetId,
      latestVersion: latestVersion || (item ? item.defaultVersion : null)
    };
  }
};

module.exports = catalogService;
