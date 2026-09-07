// DRIFTWOOD — a tiny dependency-free WebSocket server (RFC 6455, text frames) plus a static file helper.
// Shared by the dedicated server (server.js) and the desktop app's "host on this computer" mode (desktop/main.js).
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml' };

// Build one outgoing frame (server frames are never masked). Payload is a UTF-8 string or a Buffer.
function frame(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8'); const n = data.length;
  let head;
  if (n < 126) { head = Buffer.alloc(2); head[1] = n; }
  else if (n < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(n, 6); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, data]);
}

class Socket {
  constructor(sock) {
    this.sock = sock; this.open = true; this.buf = Buffer.alloc(0); this.frag = null; this.fragOp = 0;
    this.onmessage = null; this.onclose = null;
    sock.on('data', (d) => this._data(d)); sock.on('close', () => this._closed()); sock.on('error', () => this._closed());
    sock.setNoDelay(true);
  }
  send(s) { if (!this.open) return; try { this.sock.write(frame(0x1, s)); } catch (e) { } }
  close(code) { if (!this.open) return; try { const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); this.sock.write(frame(0x8, b)); } catch (e) { } this.open = false; setTimeout(() => { try { this.sock.destroy(); } catch (e) { } }, 200); }
  _closed() { if (!this.open && this.closedOnce) return; this.open = false; this.closedOnce = true; if (this.onclose) this.onclose(); }
  _data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (true) {
      const b = this.buf; if (b.length < 2) return;
      const fin = !!(b[0] & 0x80), op = b[0] & 0x0f, masked = !!(b[1] & 0x80); let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const hi = b.readUInt32BE(2), lo = b.readUInt32BE(6); len = hi * 4294967296 + lo; off = 10; }
      if (len > 8 * 1024 * 1024) { this.close(1009); return; }
      const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
      let payload = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = b.subarray(off, off + 4); const out = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ m[i & 3]; payload = out; }
      this.buf = b.subarray(need);
      if (op === 0x8) { this.close(1000); this._closed(); return; }
      if (op === 0x9) { try { this.sock.write(frame(0xA, payload)); } catch (e) { } continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        if (op !== 0x0) { this.frag = [payload]; this.fragOp = op; } else if (this.frag) this.frag.push(payload); else continue;
        if (!fin) continue;
        const whole = Buffer.concat(this.frag); this.frag = null;
        if (this.fragOp === 0x1 && this.onmessage) this.onmessage(whole.toString('utf8'));
      }
    }
  }
}

// Serve a directory (or a single HTML file) over HTTP and upgrade /ws connections to WebSockets.
// opts: { root (directory) | file (single html), inject (string appended before </head> of served html), onSocket(ws, req) }
function createServer(opts) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(opts.health ? opts.health() : { ok: true })); return; }
    let file;
    if (opts.file) { if (url !== '/' && url !== '/index.html') { res.writeHead(404); res.end('not found'); return; } file = opts.file; }
    else { const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, ''); file = path.join(opts.root, rel); if (!file.startsWith(path.resolve(opts.root))) { res.writeHead(403); res.end(); return; } }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file).toLowerCase(); const type = MIME[ext] || 'application/octet-stream';
      if (ext === '.html' && opts.inject) { let html = data.toString('utf8'); html = html.includes('</head>') ? html.replace('</head>', opts.inject + '\n</head>') : opts.inject + html; data = Buffer.from(html, 'utf8'); }
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', 'content-length': data.length }); res.end(data);
    });
  });
  server.on('upgrade', (req, sock) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || !/websocket/i.test(req.headers.upgrade || '')) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const ws = new Socket(sock); if (opts.onSocket) opts.onSocket(ws, req);
  });
  return server;
}

function lanAddresses() {
  const out = []; try { const ifs = require('os').networkInterfaces(); for (const k in ifs) for (const a of ifs[k]) if (a.family === 'IPv4' && !a.internal) out.push(a.address); } catch (e) { }
  return out;
}

module.exports = { createServer, Socket, frame, lanAddresses };
