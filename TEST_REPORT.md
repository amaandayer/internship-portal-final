# Test Report

- Date: 2026-11-14  |  Node: v22.23.4  |  Command: `npm test`
- **Result: 23 passed, 0 failed** (total 23)

| # | Test | Result |
|---|---|---|
| 1 | GET /api/internships returns list with pagination info | PASS |
| 2 | filter by category | PASS |
| 3 | search by keyword (case-insensitive) | PASS |
| 4 | pagination limit works | PASS |
| 5 | GET /api/internships/:id and 404 | PASS |
| 6 | frontend page is served | PASS |
| 7 | valid application -> 201 | PASS |
| 8 | duplicate application -> 409 | PASS |
| 9 | missing/invalid fields -> 422 with field errors | PASS |
| 10 | non-https resume url rejected (javascript: / http:) | PASS |
| 11 | wrong types rejected (mass assignment / unknown fields) | PASS |
| 12 | unknown internship -> 404 | PASS |
| 13 | invalid JSON -> 400, wrong content-type -> 415 | PASS |
| 14 | oversized body -> 413 | PASS |
| 15 | SQL injection in search is treated as data (tables survive) | PASS |
| 16 | SQL injection in category filter does not leak rows | PASS |
| 17 | SQL injection in application fields stored literally | PASS |
| 18 | secure headers present on API and static responses | PASS |
| 19 | path traversal blocked | PASS |
| 20 | internal errors do not leak stack traces | PASS |
| 21 | rate limiting returns 429 with Retry-After | PASS |
| 22 | general API rate limit applies to GET | PASS |
| 23 | client validator flags bad input and accepts good input | PASS |

Coverage areas: data loading & filtering, form validation (server + client), SQL injection, secure headers, rate limiting, path traversal, error handling.
