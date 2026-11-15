'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { openDb } = require('../src/db');
const { validate } = require('../public/validate');

let server, base, db;
const good = () => ({ internship_id: 1, name: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210',
  resume_url: 'https://example.com/cv.pdf', cover_letter: 'I love building web apps and want to learn.', consent: true });
const post = (body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(base + '/api/applications', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

before(async () => {
  db = openDb();
  server = createApp({ db, limits: { general: 1000, apply: 1000 } });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// ---------- Loading / data ----------
test('GET /api/internships returns list with pagination info', async () => {
  const r = await fetch(base + '/api/internships'); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.total, 6); assert.equal(j.items.length, 6);
});
test('filter by category', async () => {
  const j = await (await fetch(base + '/api/internships?category=design')).json();
  assert.equal(j.total, 1); assert.equal(j.items[0].category, 'design');
});
test('search by keyword (case-insensitive)', async () => {
  const j = await (await fetch(base + '/api/internships?q=jaipur')).json();
  assert.equal(j.total, 2);
});
test('pagination limit works', async () => {
  const j = await (await fetch(base + '/api/internships?limit=2&page=2')).json();
  assert.equal(j.items.length, 2); assert.equal(j.items[0].id, 3);
});
test('GET /api/internships/:id and 404', async () => {
  assert.equal((await fetch(base + '/api/internships/2')).status, 200);
  assert.equal((await fetch(base + '/api/internships/999')).status, 404);
});
test('frontend page is served', async () => {
  const r = await fetch(base + '/'); assert.equal(r.status, 200); assert.match(await r.text(), /Internship Board/);
});

// ---------- Application form (server-side validation) ----------
test('valid application -> 201', async () => {
  const r = await post(good()); assert.equal(r.status, 201); assert.ok((await r.json()).id);
});
test('duplicate application -> 409', async () => { assert.equal((await post(good())).status, 409); });
test('missing/invalid fields -> 422 with field errors', async () => {
  const r = await post({ internship_id: 1, name: 'A', email: 'bad', cover_letter: 'short', consent: false });
  const j = await r.json(); assert.equal(r.status, 422);
  for (const f of ['name', 'email', 'cover_letter', 'consent']) assert.ok(j.fields[f], f);
});
test('non-https resume url rejected (javascript: / http:)', async () => {
  for (const u of ['javascript:alert(1)', 'http://example.com/cv']) {
    const r = await post({ ...good(), email: 'x1@example.com', resume_url: u }); assert.equal(r.status, 422);
  }
});
test('wrong types rejected (mass assignment / unknown fields)', async () => {
  const r = await post({ ...good(), email: 'x2@example.com', is_admin: true }); assert.equal(r.status, 422);
  assert.equal((await post({ ...good(), internship_id: '1; DROP TABLE internships' })).status, 422);
});
test('unknown internship -> 404', async () => {
  assert.equal((await post({ ...good(), internship_id: 999, email: 'x3@example.com' })).status, 404);
});
test('invalid JSON -> 400, wrong content-type -> 415', async () => {
  assert.equal((await post('{bad json')).status, 400);
  assert.equal((await post('hello', { 'Content-Type': 'text/plain' })).status, 415);
});
test('oversized body -> 413', async () => {
  const r = await post({ ...good(), cover_letter: 'x'.repeat(20000) }).catch(() => ({ status: 413 }));
  assert.equal(r.status, 413);
});

// ---------- Security ----------
test('SQL injection in search is treated as data (tables survive)', async () => {
  const r = await fetch(base + '/api/internships?q=' + encodeURIComponent("' OR 1=1; DROP TABLE internships;--"));
  const j = await r.json(); assert.equal(r.status, 200); assert.equal(j.total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM internships').get().c, 6);
});
test('SQL injection in category filter does not leak rows', async () => {
  const j = await (await fetch(base + '/api/internships?category=' + encodeURIComponent("engineering' OR '1'='1"))).json();
  assert.equal(j.total, 0);
});
test('SQL injection in application fields stored literally', async () => {
  const r = await post({ ...good(), email: 'sqli@example.com', name: "Robert'); DROP TABLE applications;--" });
  assert.equal(r.status, 201);
  assert.equal(db.prepare('SELECT name FROM applications WHERE email=?').get('sqli@example.com').name, "Robert'); DROP TABLE applications;--");
});
test('secure headers present on API and static responses', async () => {
  for (const p of ['/api/internships', '/']) {
    const h = (await fetch(base + p)).headers;
    assert.match(h.get('content-security-policy'), /default-src 'self'/);
    assert.equal(h.get('x-content-type-options'), 'nosniff');
    assert.equal(h.get('x-frame-options'), 'DENY');
    assert.equal(h.get('referrer-policy'), 'no-referrer');
    assert.equal(h.get('x-powered-by'), null);
  }
});
test('path traversal blocked', async () => {
  for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/src/server.js', '/../src/db.js']) {
    const r = await fetch(base + p); assert.equal(r.status, 404);
  }
});
test('internal errors do not leak stack traces', async () => {
  const r = await fetch(base + '/api/nope'); const t = await r.text();
  assert.equal(r.status, 404); assert.ok(!/at .*\.js/.test(t));
});
test('rate limiting returns 429 with Retry-After', async () => {
  const s = createApp({ db: openDb(), limits: { general: 100, apply: 3 } });
  await new Promise((r) => s.listen(0, r));
  const b = `http://127.0.0.1:${s.address().port}`;
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(b + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...good(), email: `r${i}@example.com` }) });
    codes.push(r.status); if (r.status === 429) assert.ok(r.headers.get('retry-after'));
  }
  s.close();
  assert.deepEqual(codes, [201, 201, 201, 429, 429]);
});
test('general API rate limit applies to GET', async () => {
  const s = createApp({ db: openDb(), limits: { general: 3, apply: 3 } });
  await new Promise((r) => s.listen(0, r));
  const b = `http://127.0.0.1:${s.address().port}`; const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(b + '/api/internships')).status);
  s.close(); assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

// ---------- Client validator ----------
test('client validator flags bad input and accepts good input', () => {
  assert.deepEqual(validate({ name: 'Asha Verma', email: 'a@b.co', cover_letter: 'x'.repeat(25), consent: true }), {});
  const e = validate({ name: '', email: 'nope', cover_letter: 'short', consent: false, resume_url: 'http://x.com' });
  for (const f of ['name', 'email', 'cover_letter', 'consent', 'resume_url']) assert.ok(e[f], f);
});
