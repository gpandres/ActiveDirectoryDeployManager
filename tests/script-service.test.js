// vitest globals: describe, it, expect, vi are injected automatically

// vi.mock calls are hoisted to the top of the module by Vitest's transform —
// they must be declared before any require() of the mocked modules.

vi.mock('../services/config', () => ({
  default: { getConfig: () => ({ networkSharePath: '\\\\SERVER\\Share', language: 'en' }) },
  getConfig: () => ({ networkSharePath: '\\\\SERVER\\Share', language: 'en' })
}));

vi.mock('../services/i18n', () => ({
  default: { getTranslations: () => ({}) },
  getTranslations: () => ({})
}));

vi.mock('../services/template-service', () => ({
  default: {
    getWizardTemplates: () => ([
      {
        id: 'user-cid-template',
        category: 'Custom',
        name: 'CID Template',
        description: 'Custom template',
        fields: [],
        fileFields: [],
        noInstaller: false,
        isUserDefined: true
      }
    ]),
    resolve: (_id, snapshot) => (snapshot?.kind === 'user-template' ? snapshot : null)
  },
  getWizardTemplates: () => ([
    {
      id: 'user-cid-template',
      category: 'Custom',
      name: 'CID Template',
      description: 'Custom template',
      fields: [],
      fileFields: [],
      noInstaller: false,
      isUserDefined: true
    }
  ]),
  resolve: (_id, snapshot) => (snapshot?.kind === 'user-template' ? snapshot : null)
}));

const svc = require('../services/script-service');

// ── Helpers ────────────────────────────────────────────────────────────────
function base(overrides = {}) {
  return {
    name: 'TestApp',
    version: '2.0.0',
    notifyUser: false,
    silentArgs: '/S',
    customParams: {},
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — generic template', () => {
  it('returns a string containing the app name', () => {
    const script = svc.generateScript(base({ template: 'generic' }));
    expect(typeof script).toBe('string');
    expect(script).toContain('TestApp');
  });

  it('embeds silentArgs in the script', () => {
    const script = svc.generateScript(base({ template: 'generic', silentArgs: '/SILENT /NORESTART' }));
    expect(script).toContain('/SILENT /NORESTART');
  });

  it('includes the 32→64 bit redirect guard', () => {
    const script = svc.generateScript(base({ template: 'generic' }));
    expect(script).toContain('PROCESSOR_ARCHITEW6432');
  });

  it('falls back to generic when template is unknown', () => {
    const script = svc.generateScript(base({ template: 'nonexistent-template-xyz' }));
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(0);
  });

  it('uses a valid installer regex without over-escaping it', () => {
    const script = svc.generateScript(base({ template: 'generic' }));
    expect(script).toContain('-match "\\.(exe|msi|ps1)$"');
    expect(script).not.toContain('-match "\\\\.(exe|msi|ps1)$"');
    expect(script).toContain('$_.Name -ne "install.ps1"');
    expect(script).toContain('$PrimaryInstallerName = [string]($Manifest.primaryInstallerName)');
  });

  it('supports ps1 wrappers in the generic installer flow', () => {
    const script = svc.generateScript(base({ template: 'generic', silentArgs: '-Mode Silent' }));
    expect(script).toContain('$Instalador.Extension -eq ".ps1"');
    expect(script).toContain('Start-Process -FilePath "PowerShell.exe"');
    expect(script).toContain('-ExecutionPolicy Bypass -File');
  });

  it('cleans up the local cache directory after a successful install', () => {
    const script = svc.generateScript(base({ template: 'generic' }));
    expect(script).toContain('function Test-DeployCachePathSafety');
    expect(script).toContain('Remove-Item -LiteralPath $CacheDir -Recurse -Force -ErrorAction Stop');
    expect(script).toContain('Invoke-DeployCacheCleanup -CacheDir $CacheDir | Out-Null');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — wazuh template', () => {
  it('embeds the manager address', () => {
    const script = svc.generateScript(base({
      template: 'wazuh',
      customParams: { manager: '192.168.1.10', group: 'linux', password: '' }
    }));
    expect(script).toContain('192.168.1.10');
    expect(script).toContain('WAZUH_MANAGER');
  });

  it('includes the agent group', () => {
    const script = svc.generateScript(base({
      template: 'wazuh',
      customParams: { manager: '10.0.0.1', group: 'servers', password: '' }
    }));
    expect(script).toContain('servers');
    expect(script).toContain('WAZUH_AGENT_GROUP');
  });

  it('includes registration password when provided', () => {
    const script = svc.generateScript(base({
      template: 'wazuh',
      customParams: { manager: '10.0.0.1', group: 'default', password: 'mysecret' }
    }));
    expect(script).toContain('WAZUH_REGISTRATION_PASSWORD');
    expect(script).toContain('mysecret');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — winget template', () => {
  it('embeds the winget package id', () => {
    const script = svc.generateScript(base({
      template: 'winget',
      wingetId: 'Mozilla.Firefox'
    }));
    expect(script).toContain('Mozilla.Firefox');
  });

  it('includes --scope machine flag', () => {
    const script = svc.generateScript(base({
      template: 'winget',
      wingetId: 'Google.Chrome'
    }));
    expect(script).toContain('--scope machine');
  });

  it('embeds the version from cfg', () => {
    const script = svc.generateScript(base({
      template: 'winget',
      wingetId: 'Notepad++.Notepad++',
      version: '8.6.0'
    }));
    expect(script).toContain('8.6.0');
  });

  it('creates a hidden interactive user task that self-cleans when the app is already installed', () => {
    const script = svc.generateScript(base({
      template: 'winget',
      wingetId: 'Spotify.Spotify'
    }));
    expect(script).toContain('NT AUTHORITY\\INTERACTIVE');
    expect(script).toContain('-LogonType Interactive');
    expect(script).toContain('LOCALAPPDATA');
    expect(script).toContain('wscript.exe');
    expect(script).toContain('Test-WingetPackageInstalled');
    expect(script).toContain('list --id "$PackageId" --exact');
    expect(script).toContain('Complete-UserWingetTask');
    expect(script).toContain('Unregister-ScheduledTask');
    expect(script).toContain('Clear-UserWingetArtifacts');
    expect(script).toContain('WingetUserInstall_');
    expect(script).toContain('Register-ScheduledTask');
    expect(script).toContain('-ErrorAction Stop');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — odt template', () => {
  it('embeds the product id', () => {
    const script = svc.generateScript(base({
      template: 'odt',
      odtConfig: { product: 'O365ProPlusRetail', channel: 'Current', language: 'en-us', arch: '64' }
    }));
    expect(script).toContain('O365ProPlusRetail');
  });

  it('embeds the channel', () => {
    const script = svc.generateScript(base({
      template: 'odt',
      odtConfig: { product: 'O365BusinessRetail', channel: 'MonthlyEnterprise', language: 'es-es', arch: '64' }
    }));
    expect(script).toContain('MonthlyEnterprise');
  });

  it('always excludes Groove and Lync', () => {
    const script = svc.generateScript(base({
      template: 'odt',
      odtConfig: { product: 'O365BusinessRetail', channel: 'Current', language: 'en-us', arch: '64', excludeApps: [] }
    }));
    expect(script).toContain('Groove');
    expect(script).toContain('Lync');
  });

  it('adds extra excluded apps from odtConfig', () => {
    const script = svc.generateScript(base({
      template: 'odt',
      odtConfig: { product: 'O365BusinessRetail', channel: 'Current', language: 'en-us', arch: '64', excludeApps: ['Teams', 'Publisher'] }
    }));
    expect(script).toContain('Teams');
    expect(script).toContain('Publisher');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — crowdstrike template', () => {
  it('embeds the CID', () => {
    const script = svc.generateScript(base({
      template: 'crowdstrike',
      customParams: { cid: 'ABCDEF1234567890-AB' }
    }));
    expect(script).toContain('ABCDEF1234567890-AB');
    expect(script).toContain('CID=');
  });

  it('uses empty CID when not provided', () => {
    const script = svc.generateScript(base({ template: 'crowdstrike' }));
    expect(script).toContain('CID=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — custom template', () => {
  it('inlines the raw custom script code', () => {
    const code = 'Write-Host "hello world"';
    const script = svc.generateScript(base({
      template: 'custom',
      customParams: { customScript: code }
    }));
    expect(script).toContain(code);
  });

  it('uses placeholder when no customScript provided', () => {
    const script = svc.generateScript(base({ template: 'custom', customParams: {} }));
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('generateScript — notifyUser flag', () => {
  it('does NOT include Send-UserToast when notifyUser is false', () => {
    const script = svc.generateScript(base({ template: 'generic', notifyUser: false }));
    expect(script).not.toContain('Send-UserToast');
  });

  it('includes Send-UserToast when notifyUser is true', () => {
    const script = svc.generateScript(base({
      template: 'wazuh',
      notifyUser: true,
      customParams: { manager: '10.0.0.1', group: 'default', password: '' }
    }));
    expect(script).toContain('Send-UserToast');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('getTemplateList', () => {
  it('returns an array of template objects', () => {
    const list = svc.getTemplateList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('every template has id, name, category, fields, noInstaller', () => {
    const list = svc.getTemplateList();
    for (const tpl of list) {
      expect(tpl).toHaveProperty('id');
      expect(tpl).toHaveProperty('name');
      expect(tpl).toHaveProperty('category');
      expect(tpl).toHaveProperty('fields');
      expect(tpl).toHaveProperty('noInstaller');
    }
  });

  it('winget and odt have noInstaller = true', () => {
    const list = svc.getTemplateList();
    const winget = list.find(t => t.id === 'winget');
    const odt = list.find(t => t.id === 'odt');
    expect(winget?.noInstaller).toBe(true);
    expect(odt?.noInstaller).toBe(true);
  });

  it('generic template has noInstaller = false', () => {
    const list = svc.getTemplateList();
    const generic = list.find(t => t.id === 'generic');
    expect(generic?.noInstaller).toBe(false);
  });
});
