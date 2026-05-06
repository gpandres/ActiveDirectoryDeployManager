const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const configShare = require('../services/config-share');

describe('config-share', () => {
  function makeTempShare() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ad-deploy-config-share-'));
  }

  function makePayload(overrides = {}) {
    return {
      apiBaseUrl: 'https://logs.example.local',
      enrollmentToken: 'enroll_12345678901234567890',
      shareId: 'SHARE123',
      tlsFingerprint: null,
      ...overrides
    };
  }

  it('publishes and reads an optional read-only API key', async () => {
    const share = makeTempShare();
    const secret = crypto.randomBytes(32).toString('hex');
    const readApiKey = 'read_12345678901234567890';

    await configShare.writeSharedConfig(share, makePayload({ readApiKey }), secret);

    const peek = await configShare.peekSharedConfig(share);
    expect(peek.readApiKey).toBe(readApiKey);
    expect(peek.readonly).toBe(true);

    const verified = await configShare.readSharedConfig(share, secret);
    expect(verified.readApiKey).toBe(readApiKey);
    expect(verified.signature).toBeTruthy();
  });

  it('keeps signed configs without read key verifiable', async () => {
    const share = makeTempShare();
    const secret = crypto.randomBytes(32).toString('hex');
    const legacy = configShare.normalizeSharedConfig({
      version: 1,
      mode: 'dedicated',
      apiBaseUrl: 'https://logs.example.local',
      enrollmentUrl: 'https://logs.example.local/api/enroll',
      enrollmentToken: 'enroll_12345678901234567890',
      shareId: 'SHARE123',
      tlsFingerprint: null,
      readonly: true,
      issuedAt: '2026-05-06T00:00:00.000Z'
    });
    legacy.signature = configShare.sign(legacy, secret);

    const file = configShare.sharedConfigPath(share);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(legacy, null, 2), 'utf-8');

    const verified = await configShare.readSharedConfig(share, secret);
    expect(verified.readApiKey).toBeUndefined();
    expect(verified.shareId).toBe('SHARE123');
  });
});
