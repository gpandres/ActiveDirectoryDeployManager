// ═══════════════════════════════════════════════════════
// IPC Validators — lightweight type guards for IPC handler arguments.
// No external dependencies; throws TypeError/RangeError on invalid input
// so callers can wrap in try/catch and return { success:false, error }.
// ═══════════════════════════════════════════════════════

function assertString(val, name, maxLen = 512) {
  if (typeof val !== 'string') throw new TypeError(`${name} must be a string`);
  if (val.length > maxLen) throw new RangeError(`${name} too long (max ${maxLen})`);
}

function assertStringOrNull(val, name, maxLen = 512) {
  if (val !== null && val !== undefined) assertString(val, name, maxLen);
}

function assertArray(val, name) {
  if (!Array.isArray(val)) throw new TypeError(`${name} must be an array`);
}

function assertBoolean(val, name) {
  if (typeof val !== 'boolean') throw new TypeError(`${name} must be a boolean`);
}

function assertObject(val, name) {
  if (val === null || typeof val !== 'object' || Array.isArray(val))
    throw new TypeError(`${name} must be a plain object`);
}

function assertId(val, name) {
  assertString(val, name, 128);
  if (!/^[a-zA-Z0-9_\-]+$/.test(val)) throw new TypeError(`${name} contains invalid characters`);
}

module.exports = { assertString, assertStringOrNull, assertArray, assertBoolean, assertObject, assertId };
