## Why

Exposing API documentation (Swagger UI, Scalar UI, OpenAPI JSON/YAML definitions, and the `/docs` central hub) in production environments exposes endpoint routes, request schemas, and parameter vulnerabilities to external reconnaissance.

Introducing an environment-driven toggle (`ENABLE_DOCS=false` or `ENABLE_DOCS=true`) allows developers to access rich interactive documentation during development and staging while ensuring all `/docs` and `/docs/*` endpoints are completely hidden (returning HTTP 404 Not Found) in production environments.

## What Changes

- **Environment Configuration**: Add `ENABLE_DOCS` (default: `true`) to `.env.example`, `docker-compose.yml`, and `Dockerfile` `NGINX_ENVSUBST_FILTER`.
- **NGINX Virtual Host Mapping**:
  - In `default.conf.template`, map `${ENABLE_DOCS}` to a flag `$docs_disabled`.
  - When `ENABLE_DOCS=false` (or `0`), `/docs` and all `/docs/*` proxy locations immediately return HTTP 404 Not Found.
  - Public JWKS public keys (`/.well-known/jwks.json`) remain permanently active regardless of `ENABLE_DOCS` to support microservice cryptographic token verification.
- **Automated Test Coverage**: Add test cases in `tests/gateway-spec.test.mjs` verifying that `/docs` is accessible when `ENABLE_DOCS=true` and returns 404 when `ENABLE_DOCS=false`.

## Capabilities

### Modified Capabilities
- `documentation-proxy`: Add requirement for environment-driven conditional availability of documentation endpoints.

## Impact

- **Affected Files**:
  - `.env.example`
  - `docker-compose.yml`
  - `Dockerfile`
  - `nginx/templates/default.conf.template`
  - `tests/gateway-spec.test.mjs`
- **Security Posture**: Complete stealth in production for all API documentation endpoints.
