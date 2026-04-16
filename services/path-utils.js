const path = require('path');

function sanitizeDeploymentName(name, fallback = 'item') {
  if (typeof name !== 'string') return fallback;

  const collapsed = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const withoutTrailingDots = collapsed.replace(/[. ]+$/g, '');
  const safe = withoutTrailingDots.substring(0, 128);

  return safe || fallback;
}

function resolveWithinBase(baseDir, ...segments) {
  if (typeof baseDir !== 'string' || !baseDir.trim()) {
    throw new Error('Base path is not configured');
  }

  const basePath = path.resolve(baseDir);
  const targetPath = path.resolve(baseDir, ...segments);
  const relative = path.relative(basePath, targetPath);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return targetPath;
  }

  throw new Error('Path escapes configured base directory');
}

function resolveNamedSubdirectory(baseDir, rawName, fallback = 'item') {
  const safeName = sanitizeDeploymentName(rawName, fallback);
  return {
    safeName,
    path: resolveWithinBase(baseDir, safeName)
  };
}

module.exports = {
  sanitizeDeploymentName,
  resolveWithinBase,
  resolveNamedSubdirectory
};
