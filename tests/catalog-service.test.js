// vitest globals: describe, it, expect, vi, beforeEach are injected automatically

describe('catalog-service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the curated catalog payload', () => {
    const svc = require('../services/catalog-service');

    const result = svc.getCatalog();
    expect(Array.isArray(result.catalog)).toBe(true);
    expect(result.catalog.length).toBeGreaterThan(0);
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
