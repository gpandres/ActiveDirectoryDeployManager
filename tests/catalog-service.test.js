// vitest globals: describe, it, expect, vi, beforeEach are injected automatically

describe('catalog-service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('child_process');
  });

  it('returns the curated catalog payload', async () => {
    const svc = require('../services/catalog-service');

    const result = await svc.getCatalog();
    expect(Array.isArray(result.catalog)).toBe(true);
    expect(result.catalog.length).toBeGreaterThan(0);
  });

  it('exposes curated entries with their audited source metadata', async () => {
    const svc = require('../services/catalog-service');

    const result = await svc.getCatalog();
    const whatsapp = result.catalog.find(item => item.id === 'whatsapp');

    expect(whatsapp?.wingetId).toBe('9NKSQGP7F2NH');
    expect(whatsapp?.wingetSource).toBe('msstore');
  });

  it('keeps curated msstore references available', async () => {
    vi.doMock('child_process', () => ({
      execFile: vi.fn((file, args, options, callback) => {
        if (args[0] === 'show' && args.includes('9NKSQGP7F2NH')) {
          callback(null, [
            'Version: Unknown',
            'Source: msstore'
          ].join('\n'));
          return;
        }
        callback(new Error('not found'), '');
      })
    }));

    vi.resetModules();
    const svc = require('../services/catalog-service');
    const whatsapp = await svc.resolvePackage({
      wingetId: '9NKSQGP7F2NH',
      wingetSource: 'msstore',
      name: 'WhatsApp'
    });

    expect(whatsapp?.wingetId).toBe('9NKSQGP7F2NH');
    expect(whatsapp?.wingetSource).toBe('msstore');
    expect(whatsapp?.available).toBe(true);
  });

  it('parses compact search rows and resolves renamed winget ids', async () => {
    vi.doMock('child_process', () => ({
      execFile: vi.fn((file, args, options, callback) => {
        if (args[0] === 'show' && args.includes('geekSoftware.PDF24Creator')) {
          callback(new Error('not found'), '');
          return;
        }
        if (args[0] === 'search' && args.includes('PDF24 Creator')) {
          callback(null, [
            'Name          Id                            Version Source',
            '------------------------------------------------------------',
            'PDF24 Creator XPFD51H3VQZFM0                Unknown msstore',
            'PDF24 Creator geeksoftwareGmbH.PDF24Creator 11.30.0 winget'
          ].join('\n'));
          return;
        }
        callback(new Error('not found'), '');
      })
    }));

    vi.resetModules();
    const svc = require('../services/catalog-service');
    const pdf24 = await svc.resolvePackage({
      wingetId: 'geekSoftware.PDF24Creator',
      wingetSource: 'winget',
      name: 'PDF24 Creator'
    });

    expect(pdf24?.wingetId).toBe('geeksoftwareGmbH.PDF24Creator');
    expect(pdf24?.wingetSource).toBe('winget');
    expect(pdf24?.available).toBe(true);
  });

  it('rejects invalid winget ids before executing anything', async () => {
    const svc = require('../services/catalog-service');

    const result = await svc.checkSingle('Mozilla.Firefox"&calc');

    expect(result.latestVersion).toBe(null);
  });

  it('returns an empty array for queries shorter than two characters', async () => {
    const svc = require('../services/catalog-service');

    const results = await svc.searchCLI('a');

    expect(results).toEqual([]);
  });
});
