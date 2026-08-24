## 1. Gateway NGINX Configuration

- [x] 1.1 Add `/api/users/` and `/api/v1/users/` reverse proxy locations with full auth offloading, anti-spoofing, and CORS in `nginx/templates/default.conf.template`
- [x] 1.2 Add `/docs/users`, `/docs/users/swagger`, `/docs/users/openapi.json`, and `/docs/users/openapi.yaml` documentation proxy locations in `nginx/templates/default.conf.template`
- [x] 1.3 Update `/docs` HTML hub landing page in `nginx/templates/default.conf.template` to include User Service documentation links

## 2. Environment Configuration & Documentation

- [x] 2.1 Add `USER_SERVICE_URL` environment variable definition to `.env.example`
- [x] 2.2 Update `README.md` with User Service architecture diagram, route mapping specification, and verification recipes

## 3. Automated Test Suite & Verification

- [x] 3.1 Extend `tests/gateway-spec.test.mjs` with contract assertions for User Service API routing, docs proxying, and `ENABLE_DOCS` gating
- [x] 3.2 Extend `tests/auth-flow.test.mjs` with end-to-end assertions for perimeter auth verification, anti-spoofing claim stripping, and unauthenticated rejection on User Service routes
- [x] 3.3 Execute `npm test` to verify complete test suite passes
