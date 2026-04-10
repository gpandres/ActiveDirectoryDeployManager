// ═══════════════════════════════════════════════════════
// Winget App Catalog — curated list for the wizard
// ═══════════════════════════════════════════════════════

// versionCheck.method:
//   'github'  → uses GitHub releases/latest API (free, no auth, 60 req/hr)
//   'winget'  → runs `winget show --id X` via PowerShell and parses Version:
//   'none'    → no automatic version check available

const WINGET_CATALOG = [
  // ─── Navegadores ──────────────────────────────────────────
  {
    id: 'google-chrome', name: 'Google Chrome', wingetId: 'Google.Chrome',
    category: 'Navegadores', icon: '🌐', defaultVersion: '126.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'firefox', name: 'Mozilla Firefox', wingetId: 'Mozilla.Firefox',
    category: 'Navegadores', icon: '🦊', defaultVersion: '127.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'microsoft-edge', name: 'Microsoft Edge', wingetId: 'Microsoft.Edge',
    category: 'Navegadores', icon: '🔵', defaultVersion: '126.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'brave', name: 'Brave Browser', wingetId: 'Brave.Brave',
    category: 'Navegadores', icon: '🦁', defaultVersion: '1.67',
    versionCheck: { method: 'github', repo: 'brave/brave-browser' }
  },

  // ─── Herramientas ─────────────────────────────────────────
  {
    id: '7zip', name: '7-Zip', wingetId: '7zip.7zip',
    category: 'Herramientas', icon: '🗜️', defaultVersion: '24.08',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'notepadplusplus', name: 'Notepad++', wingetId: 'Notepad.Notepad',
    category: 'Herramientas', icon: '📝', defaultVersion: '8.6',
    versionCheck: { method: 'github', repo: 'notepad-plus-plus/notepad-plus-plus' }
  },
  {
    id: 'adobereader', name: 'Adobe Acrobat Reader', wingetId: 'Adobe.Acrobat.Reader.64-bit',
    category: 'Herramientas', icon: '📄', defaultVersion: '24.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'pdf24', name: 'PDF24 Creator', wingetId: 'geekSoftware.PDF24Creator',
    category: 'Herramientas', icon: '📋', defaultVersion: '11.20',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'greenshot', name: 'Greenshot', wingetId: 'Greenshot.Greenshot',
    category: 'Herramientas', icon: '📸', defaultVersion: '1.2.10',
    versionCheck: { method: 'github', repo: 'greenshot/greenshot' }
  },
  {
    id: 'sharex', name: 'ShareX', wingetId: 'ShareX.ShareX',
    category: 'Herramientas', icon: '🖼️', defaultVersion: '16.1',
    versionCheck: { method: 'github', repo: 'ShareX/ShareX' }
  },
  {
    id: 'paintnet', name: 'Paint.NET', wingetId: 'dotPDN.PaintDotNet',
    category: 'Herramientas', icon: '🎨', defaultVersion: '5.1',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'keepass', name: 'KeePass', wingetId: 'DominikReichl.KeePass',
    category: 'Herramientas', icon: '🔐', defaultVersion: '2.57',
    versionCheck: { method: 'winget' }
  },

  // ─── Conectividad ─────────────────────────────────────────
  {
    id: 'filezilla', name: 'FileZilla', wingetId: 'TimKosse.FileZilla.Client',
    category: 'Conectividad', icon: '📁', defaultVersion: '3.67',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'winscp', name: 'WinSCP', wingetId: 'WinSCP.WinSCP',
    category: 'Conectividad', icon: '🔒', defaultVersion: '6.3',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'putty', name: 'PuTTY', wingetId: 'PuTTY.PuTTY',
    category: 'Conectividad', icon: '🖥️', defaultVersion: '0.81',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'mremoteng', name: 'mRemoteNG', wingetId: 'mRemoteNG.mRemoteNG',
    category: 'Conectividad', icon: '🌐', defaultVersion: '1.77',
    versionCheck: { method: 'github', repo: 'mRemoteNG/mRemoteNG' }
  },
  {
    id: 'openvpn', name: 'OpenVPN', wingetId: 'OpenVPNTechnologies.OpenVPN',
    category: 'Conectividad', icon: '🔑', defaultVersion: '2.6',
    versionCheck: { method: 'winget' }
  },

  // ─── Comunicación ─────────────────────────────────────────
  {
    id: 'zoom', name: 'Zoom', wingetId: 'Zoom.Zoom',
    category: 'Comunicación', icon: '📹', defaultVersion: '6.1',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'teams', name: 'Microsoft Teams', wingetId: 'Microsoft.Teams',
    category: 'Comunicación', icon: '💬', defaultVersion: '24.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'slack', name: 'Slack', wingetId: 'SlackTechnologies.Slack',
    category: 'Comunicación', icon: '💜', defaultVersion: '4.39',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'discord', name: 'Discord', wingetId: 'Discord.Discord',
    category: 'Comunicación', icon: '🎮', defaultVersion: '1.0',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'whatsapp', name: 'WhatsApp', wingetId: 'WhatsApp.WhatsApp',
    category: 'Comunicación', icon: '📱', defaultVersion: '2.2',
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
    category: 'Desarrollo', icon: '💻', defaultVersion: '1.91',
    versionCheck: { method: 'github', repo: 'microsoft/vscode' }
  },
  {
    id: 'git', name: 'Git', wingetId: 'Git.Git',
    category: 'Desarrollo', icon: '🔀', defaultVersion: '2.46',
    versionCheck: { method: 'github', repo: 'git-for-windows/git' }
  },
  {
    id: 'python', name: 'Python 3', wingetId: 'Python.Python.3.12',
    category: 'Desarrollo', icon: '🐍', defaultVersion: '3.12',
    versionCheck: { method: 'winget' }
  },
  {
    id: 'nodejs', name: 'Node.js LTS', wingetId: 'OpenJS.NodeJS.LTS',
    category: 'Desarrollo', icon: '🟩', defaultVersion: '20.0',
    versionCheck: { method: 'winget' }
  },
];

// Office ODT entries — handled specially (not winget, uses ODT download)
const ODT_PRODUCTS = [
  { id: 'O365BusinessRetail',   label: 'Microsoft 365 Business',    channel: 'MonthlyEnterprise', type: '365' },
  { id: 'O365ProPlusRetail',    label: 'Microsoft 365 Apps',        channel: 'MonthlyEnterprise', type: '365' },
  { id: 'ProPlus2021Volume',    label: 'Office LTSC 2021',          channel: 'PerpetualVL2021',   type: 'ltsc' },
  { id: 'ProPlus2019Volume',    label: 'Office LTSC 2019',          channel: 'PerpetualVL2019',   type: 'ltsc' },
];

const ODT_APPS = [
  { id: 'Word',      label: 'Word',        default: true },
  { id: 'Excel',     label: 'Excel',       default: true },
  { id: 'PowerPoint',label: 'PowerPoint',  default: true },
  { id: 'Outlook',   label: 'Outlook',     default: true },
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

module.exports = { WINGET_CATALOG, ODT_PRODUCTS, ODT_APPS, ODT_LANGUAGES, ODT_CHANNELS };
