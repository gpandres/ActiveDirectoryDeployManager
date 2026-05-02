// Wraps an ipcMain handler to log failures, exceptions, and slow calls
// to the log sink. Fire-and-forget: never blocks the IPC response.
//
// Usage in main.js:
//   const { ipcLog } = require('./services/ipc-logger');
//   ipcMain.handle('scripts:deploy', ipcLog('scripts:deploy', async (_, appConfig) => { ... }));

const logSink = require('./log-sink');

const SLOW_THRESHOLD_MS = 10_000;

function ipcLog(channel, fn) {
  return async (event, ...args) => {
    const t0 = Date.now();
    let result;
    try {
      result = await fn(event, ...args);
      const elapsed = Date.now() - t0;

      if (result && result.success === false) {
        logSink.addSync('ipc_error', {
          source: 'ipc',
          level: 'warn',
          message: `${channel} failed: ${result.error || 'unknown'}`,
          elapsed
        });
      } else if (elapsed > SLOW_THRESHOLD_MS) {
        logSink.addSync('ipc_slow', {
          source: 'ipc',
          level: 'warn',
          message: `${channel} slow: ${elapsed}ms`,
          elapsed
        });
      }
      return result;
    } catch (err) {
      const elapsed = Date.now() - t0;
      logSink.addSync('ipc_exception', {
        source: 'ipc',
        level: 'error',
        message: `${channel} threw: ${String(err.message).slice(0, 300)}`,
        elapsed
      });
      throw err;
    }
  };
}

module.exports = { ipcLog };
