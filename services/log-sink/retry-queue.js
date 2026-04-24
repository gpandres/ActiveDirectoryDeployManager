// ═══════════════════════════════════════════════════════════
// Persistent retry queue (NDJSON append-only, crash-safe).
//
// Entries survive app restarts. On boot we stream the file line
// by line and rebuild the in-memory queue. Writes are appended
// immediately so a crash loses at most the line being written.
// The file is compacted (rewritten without acked entries) when
// it grows past a threshold to reclaim space.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MAX_QUEUE      = 10_000;   // in-memory cap
const COMPACT_AFTER  = 5_000;    // trigger compaction after N acked lines

function safeJsonParse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

class RetryQueue {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = [];          // [{ seq, entry }]
    this.acked = new Set();   // seq numbers known to be sent
    this.ackedCount = 0;
    this.nextSeq = 1;
    this.writeStream = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });

    if (fs.existsSync(this.filePath)) {
      await this._hydrate();
    }

    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    this.ready = true;
  }

  async _hydrate() {
    const stream = fs.createReadStream(this.filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      const rec = safeJsonParse(line);
      if (!rec) continue;
      if (rec.op === 'push' && rec.seq && rec.entry) {
        this.queue.push({ seq: rec.seq, entry: rec.entry });
        if (rec.seq >= this.nextSeq) this.nextSeq = rec.seq + 1;
      } else if (rec.op === 'ack' && Array.isArray(rec.seqs)) {
        for (const s of rec.seqs) this.acked.add(s);
      }
    }
    this.queue = this.queue.filter(e => !this.acked.has(e.seq));
    this.ackedCount = this.acked.size;
    // Start fresh after hydration — compacted file rewrites happen later.
  }

  _appendLine(obj) {
    return new Promise((resolve, reject) => {
      this.writeStream.write(JSON.stringify(obj) + '\n', (err) =>
        err ? reject(err) : resolve()
      );
    });
  }

  push(entry) {
    if (!this.ready) throw new Error('RetryQueue not initialized');
    // Drop oldest non-error entries when overflowing.
    if (this.queue.length >= MAX_QUEUE) {
      const idx = this.queue.findIndex(e => (e.entry.level ?? 1) < 3);
      if (idx !== -1) this.queue.splice(idx, 1);
      else this.queue.shift();
    }
    const seq = this.nextSeq++;
    this.queue.push({ seq, entry });
    this._appendLine({ op: 'push', seq, entry }).catch(() => {});
    return seq;
  }

  takeBatch(max) {
    return this.queue.slice(0, max);
  }

  async ack(batch) {
    if (!batch.length) return;
    const seqs = batch.map(b => b.seq);
    const set = new Set(seqs);
    this.queue = this.queue.filter(e => !set.has(e.seq));
    for (const s of seqs) this.acked.add(s);
    this.ackedCount += seqs.length;
    await this._appendLine({ op: 'ack', seqs });
    if (this.ackedCount >= COMPACT_AFTER) await this.compact();
  }

  nack(/* batch */) {
    // Entries stay in queue; no-op. Caller will retry with backoff.
  }

  async compact() {
    const tmp = this.filePath + '.compact';
    await new Promise((res, rej) => this.writeStream.end(err => err ? rej(err) : res()));
    const out = fs.createWriteStream(tmp, { flags: 'w' });
    for (const { seq, entry } of this.queue) {
      out.write(JSON.stringify({ op: 'push', seq, entry }) + '\n');
    }
    await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
    await fs.promises.rename(tmp, this.filePath);
    this.acked.clear();
    this.ackedCount = 0;
    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
  }

  size() { return this.queue.length; }

  async close() {
    if (this.writeStream) {
      await new Promise(res => this.writeStream.end(res));
      this.writeStream = null;
    }
    this.ready = false;
  }
}

module.exports = { RetryQueue };
