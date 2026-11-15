# Security Checklist

| # | Control | Status | Where / Evidence |
|---|---|---|---|
| 1 | Parameterized queries only (no string-built SQL with user input) | ✅ | `src/server.js` prepared statements; tests 15-17 |
| 2 | Server-side validation of every field (type, length, format, unknown fields rejected) | ✅ | `src/validate.js`; tests 9-11 |
| 3 | Client-side validation (UX only, server is the authority) | ✅ | `public/validate.js`; test 23 |
| 4 | Rate limiting – 100 req/min per IP on API, 5/min on POST applications, `429` + `Retry-After` | ✅ | `src/rateLimit.js`; tests 21-22 |
| 5 | Secure headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, COOP/CORP, HSTS, Permissions-Policy | ✅ | `SECURITY_HEADERS` in `src/server.js`; test 18 |
| 6 | No `X-Powered-By` / no stack traces to client | ✅ | test 18, 20 |
| 7 | XSS prevention: DOM built with `textContent`, strict CSP (no inline scripts) | ✅ | `public/app.js`, CSP header |
| 8 | Request body size limit (10 KB) + request timeouts | ✅ | `MAX_BODY`; test 14 |
| 9 | Content-Type enforcement (JSON only) | ✅ | test 13 |
| 10 | `resume_url` restricted to `https:` (blocks `javascript:`) | ✅ | test 10 |
| 11 | Path traversal protection on static files + extension allowlist | ✅ | test 19 |
| 12 | Duplicate-submission protection (UNIQUE internship+email) | ✅ | test 8 |
| 13 | No secrets in repo (`.env`, `*.db` git-ignored) | ✅ | `.gitignore` |
| 14 | Zero third-party dependencies (no supply-chain risk) | ✅ | `package.json` |

## Known limitations / next steps
- Rate limiter is in-memory per process; use Redis for multi-instance deployments.
- Behind a reverse proxy, read client IP from a trusted `X-Forwarded-For`.
- Serve over HTTPS in production (HSTS header is already set).
- Add CAPTCHA / email verification for production-scale spam protection.
