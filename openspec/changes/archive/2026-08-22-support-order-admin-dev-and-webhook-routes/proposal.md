# Proposal: Support Order Admin, Dev Simulation, and Webhook Routes

## Why

Recent updates to downstream microservices (specifically `store_order`) introduced admin order management endpoints (`/api/v1/admin/orders`), dev environment payment simulation hooks (`/api/v1/dev/orders/*`), and external payment gateway callback webhooks (`/api/v1/orders/webhook/midtrans`). Currently, requests to admin and dev routes fail with `404 Not Found` because their URL prefixes are unmapped in NGINX, and webhook notifications fail with `401 Unauthorized` because the gateway unconditionally enforces user token authentication on all `/api/v1/orders/*` routes.

Updating the gateway routing and authentication rules is required now to ensure external payment providers can notify the system of transaction settlements and administrative/dev tools can interact with the order service through the unified API perimeter.

## What Changes

- **Add Admin Order Routing**: Forward `/api/v1/admin/orders/` and `/api/admin/orders/` (and exact paths) to `${ORDER_SERVICE_URL}/api/v1/admin/orders` while enforcing authentication offload (`auth-offload.conf`), anti-spoofing, and CORS.
- **Add Dev Order Simulation Routing**: Forward `/api/v1/dev/orders/` and `/api/dev/orders/` (and exact paths) to `${ORDER_SERVICE_URL}/api/v1/dev/orders` with CORS, anti-spoofing, and proxy headers.
- **Add Payment Webhook Authentication Bypass**: Add dedicated location blocks for `/api/v1/orders/webhook/` and `/api/orders/webhook/` to bypass gateway `auth_request` verification (`auth_request off;`) while preserving anti-spoofing and proxy headers so external providers like Midtrans can post notifications without user session tokens.

## Capabilities

### New Capabilities
*(None - existing capabilities are modified)*

### Modified Capabilities
- `api-routing`: Extend reverse-proxy routing rules to include `/api/v1/admin/orders/`, `/api/v1/dev/orders/`, and `/api/v1/orders/webhook/` paths with correct upstream mapping and CORS headers.
- `auth-offloading`: Introduce webhook authentication bypass exceptions to ensure unauthenticated third-party webhook callbacks are not blocked by the perimeter `auth_request` subrequest.

## Impact

- **Affected Gateway Files**: `nginx/templates/default.conf.template`.
- **Downstream Services**: `store_order` endpoints for admin order queries/updates, development simulation, and payment settlement webhooks.
- **Security Posture**: Preserves anti-spoofing header sanitization across all routes; exempts only external webhook paths from gateway token verification (delegating signature validation to downstream order service).
