## Why

The e-commerce platform microservices (`store_auth`, `product_service`, etc.) need a single entry point that manages external client traffic, unifies API documentation, handles Cross-Origin Resource Sharing (CORS) centrally, and enforces header sanitization (anti-spoofing) while avoiding auth bottlenecking by allowing downstreams to verify tokens via JWKS.

## What Changes

- Initialize an NGINX-based API Gateway packaged with Docker and Docker Compose.
- Implement path-based reverse proxy routing for `/api/auth/*`, `/api/products/*`, and `/.well-known/jwks.json`.
- Implement centralized CORS preflight (`OPTIONS` with `204 No Content`) and response headers.
- Implement security sanitization by stripping untrusted client `X-User-*` headers while passing through `Authorization` bearer tokens and cookies.
- Implement documentation proxying for Auth and Product services (Swagger UI, Scalar UI, OpenAPI JSON/YAML).
- Support dynamic container upstream resolution via NGINX environment templates (`/etc/nginx/templates/default.conf.template`).

## Capabilities

### New Capabilities
- `api-routing`: Reverse proxy routing for `/api/auth/*`, `/api/products/*`, and `/.well-known/jwks.json` to upstream microservices.
- `cors-management`: Centralized CORS handling for preflight and standard HTTP requests with configurable origins.
- `security-headers`: Anti-spoofing header stripping (removing client-provided `X-User-*`) and security baseline headers.
- `documentation-proxy`: Unified routing to downstream API documentation UIs (Swagger and Scalar) and raw OpenAPI spec files.

### Modified Capabilities
<!-- No existing capabilities to modify -->

## Impact

- **Infrastructure**: New gateway container running NGINX Alpine on the shared Docker bridge network.
- **Microservices**: Microservices (`store_auth`, `product_service`) no longer need individual external port bindings or duplicate CORS configurations.
- **Clients**: Frontend and mobile clients interact with a unified domain/port.
