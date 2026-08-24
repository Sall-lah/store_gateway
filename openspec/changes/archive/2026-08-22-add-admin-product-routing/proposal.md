# Proposal: Add Admin Product Routing

## Why

Product management endpoints have been separated into customer-facing catalog endpoints (`/api/products`) and backoffice administrative endpoints (`/api/admin/products`). Currently, the API gateway only routes `/api/products` and rejects `/api/admin/products` with HTTP 404. Adding dedicated routing and full perimeter authentication offloading for admin product routes ensures secure and unified access to administrative product operations.

## What Changes

- Add reverse-proxy routing rules for `/api/admin/products/`, `/api/admin/products`, `/api/v1/admin/products/`, and `/api/v1/admin/products` targeting `${PRODUCT_SERVICE_URL}/api/v1/admin/products/`.
- Apply full perimeter authentication offloading (`auth-offload.conf`) to all HTTP methods on admin product endpoints (requiring a valid JWT and rejecting unauthenticated calls with 401 at the gateway perimeter).
- Apply centralized CORS (`cors.conf`), anti-spoofing header sanitization (`anti-spoofing.conf`), and standard proxy headers (`proxy-params.conf`) to admin product routes.
- Update automated test suite and gateway documentation to cover admin product routing and authentication contracts.

## Capabilities

### New Capabilities
<!-- No brand-new capability domain; extending existing gateway routing and auth specs. -->

### Modified Capabilities
- `api-routing`: Route `/api/admin/products` and `/api/v1/admin/products` to upstream `${PRODUCT_SERVICE_URL}/api/v1/admin/products/` with full auth offloading.
- `auth-offloading`: Enforce full authentication subrequest verification on all requests to `/api/admin/products` and `/api/v1/admin/products`.

## Impact

- **Affected Files**: `nginx/templates/default.conf.template`, `tests/gateway-spec.test.mjs`, `tests/auth-flow.test.mjs`, `README.md`.
- **Upstream Compatibility**: Forwards requests to `${PRODUCT_SERVICE_URL}/api/v1/admin/products/` with verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers.
- **Breaking Changes**: None; existing public `/api/products` routes remain unchanged.
