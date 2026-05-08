// ═══════════════════════════════════════════════════════
// Catalog Service — unified catalog, search & version checking
// Replaces: winget-catalog.js + winget-service.js
// ═══════════════════════════════════════════════════════

const https = require('https');
const { execFile } = require('child_process');

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
    versionCheck: { method: 'winget' },
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
    id: 'pdf24', name: 'PDF24 Creator', wingetId: 'geeksoftwareGmbH.PDF24Creator',
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
    catalogDisabled: true,
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
    id: 'whatsapp', name: 'WhatsApp', wingetId: '9NKSQGP7F2NH', wingetSource: 'msstore',
    category: 'Communication', icon: '📱', defaultVersion: '2.2',
    versionCheck: { method: 'none' }  // MS Store manages versioning internally
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
      const MAX_LENGTH = 1024 * 512; // 512KB limit
      res.on('data', chunk => {
        data += chunk;
        if (data.length > MAX_LENGTH) {
          req.destroy(new Error('Payload from GitHub exceeded 512KB bounds'));
        }
      });
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

const DEFAULT_WINGET_SOURCE = 'winget';
const WINGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9+._-]{0,255}$/;
const packageResolutionCache = new Map();

function sanitizeWingetSource(source) {
  if (typeof source !== 'string') return '';
  const normalized = source.trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(normalized) ? normalized : '';
}

function normalizePackageLabel(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function inferWingetSource(wingetId, explicitSource) {
  const sanitized = sanitizeWingetSource(explicitSource);
  if (sanitized) return sanitized;
  if (isLikelyMsStoreId(typeof wingetId === 'string' ? wingetId.trim() : '')) return 'msstore';
  return DEFAULT_WINGET_SOURCE;
}

function getVisibleCuratedCatalog() {
  return CURATED_CATALOG
    .filter(item => item?.catalogDisabled !== true)
    .map(item => ({
      ...item,
      wingetSource: inferWingetSource(item?.wingetId, item?.wingetSource)
    }));
}

function isValidWingetId(wingetId) {
  return typeof wingetId === 'string'
    && wingetId.length > 0
    && wingetId.length <= 256
    && WINGET_ID_PATTERN.test(wingetId.trim());
}

function normalizeWingetQuery(query) {
  if (typeof query !== 'string') return '';
  return query.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 128);
}

function runWinget(args, timeout) {
  return new Promise((resolve) => {
    execFile(
      'winget',
      args,
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve('');
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function parseWingetShowOutput(stdout) {
  if (!stdout || !stdout.trim()) return null;
  const clean = stdout.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
  if (/No package found|No se encontro|No se encontró/i.test(clean)) return null;

  const versionMatch = clean.match(/^(?:Version|Versi[oó]n)\s*:\s*([^\n]+)/im);
  const sourceMatch = clean.match(/^(?:Source|Origen)\s*:\s*([^\n]+)/im);
  const rawVersion = versionMatch?.[1]?.trim() || null;

  return {
    // 'Unknown' means Store manages versioning internally — treat as unavailable
    version: (rawVersion && !/^unknown$/i.test(rawVersion)) ? rawVersion : null,
    source: sanitizeWingetSource(sourceMatch?.[1] || '')
  };
}

function fetchWingetManifest(wingetId, wingetSource) {
  if (!isValidWingetId(wingetId)) return Promise.resolve(null);

  const args = ['show', '--id', wingetId.trim(), '--accept-source-agreements'];
  const normalizedSource = sanitizeWingetSource(wingetSource);
  if (normalizedSource) args.push('--source', normalizedSource);

  return runWinget(args, 15000).then(stdout => parseWingetShowOutput(stdout));
}

function checkVersionWinget(wingetId, wingetSource) {
  if (!isValidWingetId(wingetId)) return Promise.resolve(null);
  return fetchWingetManifest(wingetId, wingetSource)
    .then(manifest => manifest?.version || null);
}

function isLikelyMsStoreId(token) {
  return typeof token === 'string'
    && /^[A-Z0-9]{10,16}$/i.test(token)
    && /\d/.test(token);
}

function isLikelyWingetSearchId(token) {
  if (!isValidWingetId(token)) return false;
  if (isLikelyWingetVersion(token)) return false;
  return token.includes('.')
    || token.includes('-')
    || token.includes('_')
    || token.includes('+')
    || isLikelyMsStoreId(token);
}

function isLikelyWingetVersion(token) {
  return typeof token === 'string'
    && (/^unknown$/i.test(token) || /^[vV]?\d[\w.+-]*$/.test(token));
}

function parseWingetSearchResultLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const wingetSource = sanitizeWingetSource(tokens[tokens.length - 1]);
  if (!wingetSource) return null;

  const bodyTokens = tokens.slice(0, -1);
  let idIndex = -1;
  for (let i = bodyTokens.length - 1; i >= 0; i -= 1) {
    if (isLikelyWingetSearchId(bodyTokens[i])) {
      idIndex = i;
      break;
    }
  }

  if (idIndex <= 0) return null;

  const wingetId = bodyTokens[idIndex];
  const name = bodyTokens.slice(0, idIndex).join(' ').trim() || wingetId;
  const tailTokens = bodyTokens.slice(idIndex + 1);
  const version = tailTokens[0] && isLikelyWingetVersion(tailTokens[0]) && !/^unknown$/i.test(tailTokens[0])
    ? tailTokens[0]
    : '';
  const match = (version ? tailTokens.slice(1) : tailTokens).join(' ').trim();

  return {
    id: wingetId.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    wingetId,
    wingetSource,
    version,
    match,
    category: 'Winget',
    icon: '&#128230;',
    source: 'winget-cli'
  };
}



function pickPreferredPackageCandidate(results, reference) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const preferredId = typeof reference?.wingetId === 'string' ? reference.wingetId.trim().toLowerCase() : '';
  const preferredSource = sanitizeWingetSource(reference?.wingetSource);
  const preferredName = normalizePackageLabel(reference?.name || '');

  if (preferredId) {
    const exactSameSource = results.find(item =>
      item.wingetId.toLowerCase() === preferredId
      && (!preferredSource || item.wingetSource === preferredSource)
    );
    if (exactSameSource) return exactSameSource;

    const exactAnySource = results.find(item => item.wingetId.toLowerCase() === preferredId);
    if (exactAnySource) return exactAnySource;
  }

  const exactNameMatches = results.filter(item => normalizePackageLabel(item.name) === preferredName);
  if (exactNameMatches.length === 0) return null;

  const sourcePriority = [preferredSource, DEFAULT_WINGET_SOURCE, 'msstore'].filter(Boolean);
  exactNameMatches.sort((left, right) => {
    const leftRank = sourcePriority.indexOf(left.wingetSource);
    const rightRank = sourcePriority.indexOf(right.wingetSource);
    return (leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank)
      - (rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank);
  });

  return exactNameMatches[0] || null;
}

async function resolvePackageReference(reference) {
  const cacheKey = JSON.stringify({
    id: typeof reference?.wingetId === 'string' ? reference.wingetId.trim() : '',
    source: sanitizeWingetSource(reference?.wingetSource),
    name: typeof reference?.name === 'string' ? reference.name.trim().toLowerCase() : ''
  });
  if (packageResolutionCache.has(cacheKey)) {
    return { ...packageResolutionCache.get(cacheKey) };
  }

  const normalizedId = typeof reference?.wingetId === 'string' ? reference.wingetId.trim() : '';
  const normalizedSource = inferWingetSource(normalizedId, reference?.wingetSource);
  const normalizedName = normalizeWingetQuery(reference?.name || '');

  let resolved = {
    wingetId: normalizedId,
    wingetSource: normalizedSource,
    latestVersion: null,
    name: reference?.name || '',
    available: false
  };

  if (isValidWingetId(normalizedId)) {
    let manifest = await fetchWingetManifest(normalizedId, normalizedSource);

    // Source fallback: if not found, try the other source
    if (!manifest) {
      const fallbackSource = normalizedSource === 'msstore' ? DEFAULT_WINGET_SOURCE : 'msstore';
      manifest = await fetchWingetManifest(normalizedId, fallbackSource);
    }

    if (manifest) {
      const confirmedSource = manifest.source || normalizedSource;
      resolved = {
        wingetId: normalizedId,
        wingetSource: confirmedSource,
        latestVersion: manifest.version || null,
        name: reference?.name || '',
        available: true
      };
      packageResolutionCache.set(cacheKey, resolved);
      return { ...resolved };
    }
  }

  if (normalizedName.length >= 2) {
    const searchResults = await searchWingetCLI(normalizedName);
    const candidate = pickPreferredPackageCandidate(searchResults, reference);
    if (candidate) {
      resolved = {
        wingetId: candidate.wingetId,
        wingetSource: candidate.wingetSource || normalizedSource,
        latestVersion: candidate.version || null,
        name: candidate.name || reference?.name || '',
        available: true
      };
    }
  }

  packageResolutionCache.set(cacheKey, resolved);
  return { ...resolved };
}

async function resolveCatalogWingetItem(item) {
  if (item?.versionCheck?.method !== 'winget') return { ...item };

  const resolved = await resolvePackageReference(item);
  if (!resolved?.available || !resolved.wingetId) return { ...item };

  return {
    ...item,
    name: resolved.name || item.name,
    wingetId: resolved.wingetId,
    wingetSource: resolved.wingetSource || item.wingetSource || DEFAULT_WINGET_SOURCE
  };
}

async function resolveCuratedCatalog() {
  return getVisibleCuratedCatalog().map(item => ({ ...item }));
}

// ─── CLI Winget Search ───────────────────────────────────────
// Uses the local winget binary — stable, no external API dependency.

function parseWingetSearchResults(stdout) {
  if (!stdout || !stdout.trim()) return [];

  const clean = stdout.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
  const lines = clean.split('\n').filter(line => line.trim());
  const sepIdx = lines.findIndex(line => /^[-\u2500-\u257f]{3,}/.test(line.trim()));
  if (sepIdx < 1) return [];

  return lines.slice(sepIdx + 1)
    .map(line => parseWingetSearchResultLine(line))
    .filter(Boolean)
    .slice(0, 30);
}

function searchWingetCLI(query) {
  const safeQuery = normalizeWingetQuery(query);
  if (!safeQuery || safeQuery.length < 2) return Promise.resolve([]);

  return runWinget(['search', '--query', safeQuery, '--accept-source-agreements'], 25000)
    .then(stdout => parseWingetSearchResults(stdout));
}

const catalogService = {
  /**
   * Returns the curated catalog + ODT data (for the app wizard and catalog page).
   * Backward-compatible with the old wingetService.getCatalog() shape.
   */
  async getCatalog() {
    return {
      catalog: await resolveCuratedCatalog(),
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
    const visibleCatalog = await resolveCuratedCatalog();

    // 1. Filter curated catalog
    let curated = visibleCatalog.filter(item => {
      const matchCat = cat === 'Todo' || item.category === cat;
      const matchQ = !q
        || item.name.toLowerCase().includes(q)
        || item.wingetId.toLowerCase().includes(q)
        || (item.wingetSource || '').includes(q)
        || item.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    }).map(item => ({ ...item, source: 'curated' }));

    if (q.length >= 2) {
      curated = await Promise.all(
        curated.map(async item => ({
          ...(await resolveCatalogWingetItem(item)),
          source: 'curated'
        }))
      );
    }

    // 2. If query is provided, also search via winget CLI for extended results
    let cliResults = [];
    if (q.length >= 2 && (cat === 'Todo' || cat === 'Winget')) {
      try {
        cliResults = await searchWingetCLI(q);
        // Remove duplicates already present in curated
        const curatedIds = new Set(curated.map(c => `${(c.wingetId || '').toLowerCase()}|${(c.wingetSource || DEFAULT_WINGET_SOURCE).toLowerCase()}`));
        cliResults = cliResults.filter(r =>
          !curatedIds.has(`${(r.wingetId || '').toLowerCase()}|${(r.wingetSource || DEFAULT_WINGET_SOURCE).toLowerCase()}`)
        );
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
    const visibleCatalog = await resolveCuratedCatalog();
    const items = (catalogIds || [])
      .map(id => visibleCatalog.find(a => a.id === id))
      .filter(Boolean);

    const results = await Promise.allSettled(
      items.map(async (item) => {
        let latestVersion = null;
        let resolvedItem = { ...item };
        try {
          if (item.versionCheck.method === 'github') {
            latestVersion = await checkVersionGitHub(item.versionCheck.repo);
          } else if (item.versionCheck.method === 'winget') {
            resolvedItem = await resolveCatalogWingetItem(item);
            latestVersion = resolvedItem.versionCheck?.method === 'winget'
              ? (await checkVersionWinget(resolvedItem.wingetId, resolvedItem.wingetSource))
              : null;
          }
        } catch { /* ignore individual failures */ }
        return {
          id: resolvedItem.id,
          wingetId: resolvedItem.wingetId,
          wingetSource: resolvedItem.wingetSource || DEFAULT_WINGET_SOURCE,
          name: resolvedItem.name,
          icon: resolvedItem.icon,
          catalogVersion: resolvedItem.defaultVersion,
          latestVersion: latestVersion || resolvedItem.defaultVersion
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
  async checkSingle(wingetId, wingetSource, name) {
    const safeId = typeof wingetId === 'string' ? wingetId.trim() : '';
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeNameNormalized = safeName.toLowerCase();
    if (!safeId && !safeName) {
      return { wingetId: null, wingetSource: null, latestVersion: null };
    }

    const resolved = await resolvePackageReference({
      wingetId: safeId,
      wingetSource,
      name: safeName
    });
    const visibleCatalog = await resolveCuratedCatalog();
    const item = visibleCatalog.find(entry =>
      (resolved?.wingetId
        && entry.wingetId === resolved.wingetId
        && (entry.wingetSource || DEFAULT_WINGET_SOURCE) === (resolved.wingetSource || DEFAULT_WINGET_SOURCE))
      || (safeId && entry.wingetId === safeId)
      || (safeNameNormalized && entry.name.toLowerCase() === safeNameNormalized)
    );
    let latestVersion = null;
    
    if (item?.versionCheck?.method === 'none') {
      // Version managed externally (e.g. MS Store) — skip check, return default
      latestVersion = null;
    } else if (item?.versionCheck?.method === 'github') {
      latestVersion = await checkVersionGitHub(item.versionCheck.repo);
    } else if (resolved?.wingetId) {
      latestVersion = resolved.latestVersion || await checkVersionWinget(resolved.wingetId, resolved.wingetSource);
    } else if (safeId && isValidWingetId(safeId)) {
      latestVersion = await checkVersionWinget(safeId, inferWingetSource(safeId, wingetSource));
    }

    return {
      wingetId: resolved?.wingetId || safeId || null,
      wingetSource: resolved?.wingetSource || sanitizeWingetSource(wingetSource) || null,
      latestVersion: latestVersion || item?.defaultVersion || null
    };
  },

  async resolvePackage(reference) {
    const resolved = await resolvePackageReference(reference || {});
    return {
      wingetId: resolved?.wingetId || '',
      wingetSource: resolved?.wingetSource || inferWingetSource(reference?.wingetId, reference?.wingetSource),
      latestVersion: resolved?.latestVersion || null,
      name: resolved?.name || reference?.name || '',
      available: !!resolved?.available
    };
  }
};

module.exports = catalogService;
