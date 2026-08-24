## 1. NGINX Configuration & Auth Subrequest Setup

- [x] 1.1 Create `nginx/snippets/auth-offload.conf` implementing `auth_request /_auth_verify;` and extracting `$upstream_http_x_user_id`, `$upstream_http_x_user_role`, and `$upstream_http_x_user_email` into downstream headers.
- [x] 1.2 Add internal location `location = /_auth_verify` in `nginx/templates/default.conf.template` proxying authentication tokens to `${AUTH_SERVICE_URL}/api/auth/me`.
- [x] 1.3 Update `nginx/snippets/anti-spoofing.conf` to strip untrusted client headers before populating verified headers.

## 2. Route Protection & Proxy Rules

- [x] 2.1 Configure protected product mutating routes (`POST /api/products`, `PUT /api/products/*`, `DELETE /api/products/*`) to enforce `auth-offload.conf`.
- [x] 2.2 Preserve anonymous pass-through for public endpoints (`GET /api/products`, `GET /docs/*`, `GET /health`, `GET /.well-known/jwks.json`, `ALL /api/auth/*`).

## 3. Testing & Verification

- [x] 3.1 Update `tests/auth-flow.test.mjs` to test the full Gateway Offloading lifecycle (valid token forwarding, role injection, 401 unauthenticated rejection, and header spoofing sanitization).
- [x] 3.2 Execute automated test suite to verify end-to-end gateway authentication offloading.
