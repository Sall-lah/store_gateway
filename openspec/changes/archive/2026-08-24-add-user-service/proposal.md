# Proposal: Integrate User Service into Store Gateway

## Why

The `user_service` microservice has been developed and deployed to handle user profile management, account lifecycle coordination (such as account deletion), in-app notification feeds, and user communication preferences. To securely expose these capabilities to frontend clients, `store_gateway` must reverse-proxy User Service endpoints, enforce perimeter authentication offloading via `store_auth`, strip untrusted identity headers, inject verified caller claims (`X-User-Id`, `X-User-Role`, `X-User-Email`), and integrate User Service API documentation into the unified documentation hub.

## What Changes

- **User Service API Reverse Proxy Routing**: Configure reverse-proxy routing for `/api/users/*` and `/api/v1/users/*` (as well as exact matches `/api/users` and `/api/v1/users`) targeting `${USER_SERVICE_URL}/api/users/*`.
- **Perimeter Authentication Offloading**: Enforce full perimeter authentication offloading (`/_auth_verify`) across all `/api/users/*` routes. Unauthenticated or invalid token requests are terminated at the gateway perimeter with `401 Unauthorized`.
- **Anti-Spoofing & Claim Injection**: Strip all incoming client `X-User-*` headers and inject verified `X-User-Id`, `X-User-Role`, and `X-User-Email` extracted from `store_auth` token verification into downstream requests.
- **Documentation Hub & OpenAPI Proxying**:
  - Proxy User Service Swagger UI at `/docs/users` and `/docs/users/swagger` targeting `${USER_SERVICE_URL}/docs` (or `${USER_SERVICE_URL}/swagger`).
  - Proxy raw OpenAPI schema definitions at `/docs/users/openapi.json` and `/docs/users/openapi.yaml` targeting `${USER_SERVICE_URL}/docs/openapi.json` and `${USER_SERVICE_URL}/docs/openapi.yaml`.
  - Update the central `/docs` landing page HTML to include User Service Swagger UI and OpenAPI links.
  - Ensure all User Service documentation routes respect the `ENABLE_DOCS` toggle (returning `404 Not Found` when disabled).
- **Configuration & Environment Support**: Introduce `USER_SERVICE_URL` in `.env.example`, virtual host templates, and documentation.
- **Automated Verification**: Extend test suites (`gateway-spec.test.mjs`, `auth-flow.test.mjs`) to validate User Service routing, auth offloading, anti-spoofing sanitization, and documentation proxying.

## Capabilities

### New Capabilities

*(None - existing capabilities are modified to incorporate the new service)*

### Modified Capabilities

- `api-routing`: Add requirements and scenarios for routing `/api/users/*` and `/api/v1/users/*` to `${USER_SERVICE_URL}/api/users/*` with full auth offloading, anti-spoofing, and CORS.
- `auth-offloading`: Add requirements and scenarios for enforcing perimeter authentication verification and verified claim injection on User Service endpoints.
- `documentation-proxy`: Add requirements and scenarios for proxying User Service Swagger UI and OpenAPI JSON/YAML specifications, updating the central `/docs` portal, and gating access via `ENABLE_DOCS`.

## Impact

- **NGINX Virtual Host Template**: `nginx/templates/default.conf.template` updated with User Service API and documentation location blocks and `/docs` hub link.
- **Environment Configuration**: `.env.example` and `README.md` updated to document `USER_SERVICE_URL`.
- **Specification Documentation**: OpenSpec delta specs created for `api-routing`, `auth-offloading`, and `documentation-proxy`.
- **Test Suites**: `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs` updated with comprehensive assertions for User Service integration.
