'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');
const { validateApplication } = require('./validate');
const { createRateLimiter } = require('./rateLimit');
const { logRequests } = require('./logger');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 10 * 1024; // 10 KB
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
};

function createApp({ db = openDb(), limits = {} } = {}) {
  const cfg = { general: 100, apply: 5, windowMs: 60_000, ...limits };
  const limiter = createRateLimiter({ windowMs: cfg.windowMs });

  // All SQL uses prepared statements with bound parameters (no string concatenation of user input).
  const stmts = {
    byId: db.prepare('SELECT * FROM internships WHERE id = ?'),
    insertApp: db.prepare('INSERT INTO applications(internship_id,name,email,phone,resume_url,cover_letter) VALUES(?,?,?,?,?,?)'),
  };

  function send(res, status, obj, extra = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { ...SECURITY_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...extra });
    res.end(body);
  }

  function listInternships(url) {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const category = (url.searchParams.get('category') || '').trim().slice(0, 30);
    const type = (url.searchParams.get('type') || '').trim().slice(0, 20);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10));
    const where = []; const params = [];
    if (q) {
      where.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')");
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`; params.push(like, like, like);
    }
    if (category) { where.push('category = ?'); params.push(category); }
    if (type) { where.push('type = ?'); params.push(type); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''; // w contains only fixed SQL fragments + ? placeholders
    const total = db.prepare(`SELECT COUNT(*) AS c FROM internships ${w}`).get(...params).c;
    const items = db.prepare(`SELECT * FROM internships ${w} ORDER BY id LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    return { items, page, limit, total };
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (ct !== 'application/json') return reject({ status: 415, message: 'Content-Type must be application/json' });
      let size = 0; const chunks = []; let done = false;
      req.on('data', (c) => {
        if (done) return;
        size += c.length;
        if (size > MAX_BODY) { done = true; reject({ status: 413, message: 'Payload too large' }); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (done) return;
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject({ status: 400, message: 'Invalid JSON' }); }
      });
      req.on('error', () => reject({ status: 400, message: 'Request error' }));
    });
  }

  function serveStatic(res, pathname) {
    let rel;
    try { rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, ''); }
    catch { return send(res, 400, { error: 'Bad request' }); }
    const file = path.resolve(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep) || !MIME[path.extname(file)]) return send(res, 404, { error: 'Not found' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const ip = req.socket.remoteAddress || 'unknown';
      const isApply = req.method === 'POST' && url.pathname === '/api/applications';

      if (url.pathname.startsWith('/api/')) {
        const g = limiter(`g:${ip}`, cfg.general);
        const a = isApply ? limiter(`a:${ip}`, cfg.apply) : { allowed: true, retryAfter: 0 };
        if (!g.allowed || !a.allowed) {
          const ra = Math.max(!g.allowed ? g.retryAfter : 0, !a.allowed ? a.retryAfter : 0) || 1;
          return send(res, 429, { error: 'Too many requests. Please retry later.', retryAfter: ra }, { 'Retry-After': String(ra) });
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/api/internships') return send(res, 200, listInternships(url));

      const m = url.pathname.match(/^\/api\/internships\/(\d{1,9})$/);
      if (req.method === 'GET' && m) {
        const row = stmts.byId.get(Number(m[1]));
        return row ? send(res, 200, row) : send(res, 404, { error: 'Internship not found' });
      }

      if (isApply) {
        let body;
        try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: e.message || 'Bad request' }, { Connection: 'close' }); }
        const v = validateApplication(body);
        if (!v.ok) return send(res, 422, { error: 'Validation failed', fields: v.errors });
        if (!stmts.byId.get(v.value.internship_id)) return send(res, 404, { error: 'Internship not found' });
        try {
          const r = stmts.insertApp.run(v.value.internship_id, v.value.name, v.value.email, v.value.phone, v.value.resume_url, v.value.cover_letter);
          return send(res, 201, { id: Number(r.lastInsertRowid), message: 'Application submitted' });
        } catch (e) {
          if (/UNIQUE/i.test(String(e.message))) return send(res, 409, { error: 'You have already applied to this internship' });
          throw e;
        }
      }

      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      return serveStatic(res, url.pathname);
    } catch (err) {
      console.error('Unhandled error:', err); // details stay in logs, never sent to client
      if (!res.headersSent) send(res, 500, { error: 'Internal server error' });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.prependListener('request', logRequests(() => {}));
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const db = openDb(process.env.DB_FILE || 'internships.db');
  createApp({ db }).listen(port, () => console.log(`Internship board running at http://localhost:${port}`));
}
module.exports = { createApp };
