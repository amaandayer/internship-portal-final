# Internship Board – Secure Application Integration

Frontend (vanilla HTML/CSS/JS) connected to a Node.js API with a validated application form.
**Zero npm dependencies** – needs only Node.js >= 22.5 (uses built-in `node:sqlite`, `node:http`, `node:test`).

## Run
```bash
npm start        # http://localhost:3000
npm test         # runs 23 automated tests
```

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/internships?q=&category=&type=&page=&limit=` | List / search / filter |
| GET | `/api/internships/:id` | Single internship |
| POST | `/api/applications` | Submit application (JSON) |
| GET | `/api/health` | Health check |

**POST body:** `internship_id, name, email, phone?, resume_url? (https), cover_letter (20-1000), consent=true`
**Responses:** 201 created · 400 bad JSON · 404 · 409 duplicate · 413 too large · 415 wrong content-type · 422 validation (`fields` map) · 429 rate limited (`Retry-After`)

## Frontend states
- **Loading:** skeleton cards + "Loading internships…"
- **Failure:** error box with **Retry** button (auto-retries GET twice with backoff, 8s timeout)
- **Empty:** "No internships match your search."
- **Form:** client validation → server validation (422 errors shown per field) → submit disabled while sending → success / duplicate / rate-limit / network-failure messages (resubmit = retry)

## Structure
```
src/      server.js, db.js, validate.js, rateLimit.js
public/   index.html, app.js, validate.js, styles.css
data/     internships.json (seed data)
test/     api.test.js
SECURITY_CHECKLIST.md   TEST_REPORT.md
```
