const http = require('http');
function post(p, b) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(b);
    const q = http.request({
      host: '127.0.0.1', port: 8080, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': d.length }
    }, s => {
      let x = '';
      s.on('data', c => x += c);
      s.on('end', () => {
        console.log('=== ' + p + ' (' + s.statusCode + ') ===');
        console.log(x);
        res();
      });
    });
    q.on('error', rej);
    q.write(d);
    q.end();
  });
}
(async () => {
  await post('/api/admin/api-keys', { name: 'bootstrap-admin', scope: 'admin' });
  await post('/api/admin/api-keys', { name: 'dashboard-read', scope: 'read' });
  await post('/api/admin/share-secrets', { shareId: 'TEST0001' });
  await post('/api/admin/enrollment-tokens', { shareId: 'TEST0001', ttlHours: 24, usesLeft: 5 });
})().catch(e => console.error('ERR', e));
