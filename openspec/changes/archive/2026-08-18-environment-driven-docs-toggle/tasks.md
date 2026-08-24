## 1. Environment & Docker Configuration

- [x] 1.1 Update `Dockerfile` to add `ENABLE_DOCS=true` and include `ENABLE_DOCS` in `NGINX_ENVSUBST_FILTER`.
- [x] 1.2 Update `.env.example` and `docker-compose.yml` with `ENABLE_DOCS` variable definition.

## 2. NGINX Template Configuration

- [x] 2.1 Add `map "${ENABLE_DOCS}" $docs_disabled` to `nginx/templates/default.conf.template`.
- [x] 2.2 Add `$docs_disabled` evaluation returning HTTP 404 to `/docs` and all `/docs/*` location blocks in `nginx/templates/default.conf.template`.

## 3. Testing & Verification

- [x] 3.1 Update `tests/gateway-spec.test.mjs` to add automated test cases for `ENABLE_DOCS=true` (accessible) and `ENABLE_DOCS=false` (404 Not Found).
- [x] 3.2 Execute automated test suite to ensure all tests pass.
