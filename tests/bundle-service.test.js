const bundleService = require('../services/bundle-service');

describe('bundle-service uninstall scripts', () => {
  it('generates bundle uninstall scripts in reverse order with uninstall.ps1 paths', () => {
    const bundle = {
      name: 'Pack Oficina',
      version: '1.2.3',
      notifyUser: false,
      apps: [
        { appId: 'app-1', name: 'Chrome', order: 1 },
        { appId: 'app-2', name: 'PDF24', order: 2 }
      ]
    };
    const apps = [
      { id: 'app-1', name: 'Chrome' },
      { id: 'app-2', name: 'PDF24' }
    ];
    const config = {
      networkSharePath: '\\\\SERVER\\Deploy'
    };

    const script = bundleService.generateBundleUninstallScript(bundle, apps, config);

    const pdf24Index = script.indexOf('PDF24');
    const chromeIndex = script.indexOf('Chrome');
    expect(script).toContain('uninstall.ps1');
    expect(script).toContain('BundleUninstallLog');
    expect(script).toContain('[uninstall]');
    expect(pdf24Index).toBeGreaterThan(-1);
    expect(chromeIndex).toBeGreaterThan(-1);
    expect(pdf24Index).toBeLessThan(chromeIndex);
  });
});
