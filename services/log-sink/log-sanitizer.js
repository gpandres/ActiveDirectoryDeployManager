// Masks sensitive fields in log detail/context objects before they touch
// disk or the wire. Called from activity-log.add() and remote-sink._stripContext().

const SENSITIVE_KEY = /\b(password|passwd|pwd|secret|token|apikey|api_key|sitetoken|agentkey|cid|customid|enrollmenttoken|credential|auth|privatekey|private_key)\b/i;

const MASK = '[REDACTED]';

function maskScalar(val) {
  if (typeof val === 'string') return val.length > 0 ? MASK : '';
  return MASK;
}

function sanitize(obj, depth = 0) {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitize(item, depth + 1));
  if (typeof obj !== 'object') return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = maskScalar(v);
    } else if (v !== null && typeof v === 'object') {
      out[k] = sanitize(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { sanitize };
