# Internship Board - Production-Ready Capstone

Full-stack internship portal: vanilla HTML/CSS/JS frontend + Node.js API with SQLite, validated application form, rate limiting and automated tests. Zero npm dependencies (Node.js >= 22.5).

- **Live app:**  https://internship-portal-final.onrender.com                                                                                                          
- **Walkthrough video:** PASTE-VIDEO-URL-HERE
- **Health check:** `/api/health`

## Project journey
| Milestone | Repo |
| --- | --- |
| 1. Responsive board (frontend) | https://github.com/amaandayer/internship-board |
| 2. REST API + persistence | https://github.com/amaandayer/internship-api |
| 3-4. Secure integration | https://github.com/amaandayer/secure-internship-integration |
| 5. Capstone | this repository |

## Quick start
```
npm start        # http://localhost:3000
npm test         # 23 automated tests
```

## Engineering decisions
- **No framework / no dependencies:** uses built-in `node:http`, `node:sqlite` and `node:test`.
- **SQLite with parameterized queries:** prevents SQL injection.
- **Validation on both sides:** client for fast feedback, server (422 per-field errors) as source of truth.
- **Rate limiting (429 + Retry-After):** protects the application endpoint.
- **Duplicate protection (409):** one application per person per internship.
- **Resilient UI:** loading skeletons, retry with backoff, empty and error states.
- **Structured JSON logging (src/logger.js):** one line per request with id, method, path, status, duration. Query strings and bodies are not logged.
- **Health check:** `GET /api/health`.

## Quality checks
| Check | Result |
| --- | --- |
| Regression tests (`npm test`) | FILL-IN / 23 passing |
| Lighthouse Accessibility | 100 / 100 |
| Lighthouse Performance | 100 / 100 |
| Lighthouse Best Practices | 96 / 100 |
| Keyboard-only navigation | FILL-IN |
| Mobile layout (375px) | FILL-IN |

See SECURITY_CHECKLIST.md and TEST_REPORT.md for details.

## Next steps
- Admin login to view applications
- PostgreSQL for multi-instance deployment
- CI with GitHub Actions
