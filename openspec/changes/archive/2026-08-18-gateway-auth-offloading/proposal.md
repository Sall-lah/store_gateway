## Why

In the current microservice architecture, downstream services (such as `store_product`) rely on Gateway Authentication Offloading—trusting internal `X-User-Id` and `X-User-Role` headers forwarded by `store_gateway`. However, `store_gateway` currently strips all `X-User-*` headers for anti-spoofing without verifying the client's incoming JWT or injecting verified user identity headers. As a result, authenticated requests to protected endpoints fail with HTTP 403 Forbidden.

Implementing Gateway Authentication Offloading ensures the API Gateway verifies the caller's identity once at the perimeter and injects cryptographically verified user metadata into downstream requests.

## What Changes

- **Gateway Authentication Verification**: Introduce NGINX `auth_request` subrequest mechanism querying `store_auth` (`/api/auth/verify` or `/api/auth/me`) on protected routes.
- **Sanitization and Secure Header Injection**: Strip untrusted external `X-User-*` headers from incoming clients, and inject verified headers (`X-User-Id`, `X-User-Role`, `X-User-Email`) extracted from the auth verification response before proxying downstream.
- **Route Policy Differentiation**:
  - Public routes (`GET /api/products`, `GET /docs/*`, `GET /health`, `GET /.well-known/jwks.json`, `ALL /api/auth/*`) remain publicly accessible without requiring token verification.
  - Protected routes (mutating `POST/PUT/DELETE /api/products/*` or explicitly secured endpoints) enforce authentication, rejecting unauthenticated requests with `401 Unauthorized` before reaching downstream services.
- **Test Suite Updates**: Add automated integration tests verifying that valid JWTs result in properly injected `X-User-*` headers downstream, while invalid/spoofed requests are rejected or sanitized.

## Capabilities

### New Capabilities
- `auth-offloading`: Covers gateway-level token validation via auth subrequests, extraction of user claims, secure header injection (`X-User-Id`, `X-User-Role`), and perimeter rejection of unauthorized requests.

### Modified Capabilities
- `api-routing`: Update reverse proxy specifications for downstream services (such as Product Service) to forward verified user identity headers alongside original payloads.

## Impact

- **Affected Gateway Configs**:
  - `nginx/templates/default.conf.template`
  - `nginx/snippets/anti-spoofing.conf`
  - `nginx/snippets/auth-verify.conf` (new snippet)
- **Downstream Contract**:
  - Downstream services safely consume `X-User-Id` and `X-User-Role` without needing duplicate cryptographic JWKS token verification logic.
- **API Tests**:
  - `tests/auth-flow.test.mjs` and `tests/gateway-spec.test.mjs`.
