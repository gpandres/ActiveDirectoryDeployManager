// vitest globals: describe, it, expect are injected automatically

const {
  sanitizeDeploymentName,
  resolveWithinBase,
  resolveNamedSubdirectory
} = require('../services/path-utils');

describe('path-utils', () => {
  it('sanitizes characters that can alter Windows paths', () => {
    expect(sanitizeDeploymentName('..\\Finance/App:*?')).toBe('.. Finance App');
  });

  it('blocks paths that escape the configured base directory', () => {
    expect(() => resolveWithinBase('C:\\Deploy', '..\\Windows')).toThrow('Path escapes configured base directory');
  });

  it('resolves sanitized child directories inside the configured base directory', () => {
    const result = resolveNamedSubdirectory('C:\\Deploy', 'Sales/App', 'App');

    expect(result.safeName).toBe('Sales App');
    expect(result.path).toBe('C:\\Deploy\\Sales App');
  });
});
