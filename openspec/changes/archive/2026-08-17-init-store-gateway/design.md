## Context

The current active microservice architecture consists strictly of three services:
1. **`store_auth`** (Auth Service on port `8080`): Handles user authentication, token issuance, RS256 JWKS key distribution at `/.well-known/jwks.json`, and Swagger documentation.
2. **`product_service`** (Product Service on port `8040`): Handles the product catalog, in-memory RS256 JWKS token validation, and documentation (Scalar and Swagger UI).
3. **`redis`** (Cache/Session Store on port `6379`): Internal backend dependency for caching and token blacklisting; not directly exposed via the HTTP gateway.

`store_gateway` acts as the edge reverse proxy using NGINX Alpine, standardizing routing conventions (`/api/auth/*`, `/api/products/*`, `/.well-known/jwks.json`), centralizing CORS handling, stripping untrusted user headers, and proxying documentation portals.

## Goals / Non-Goals

**Goals:**
- Provide a single entry point on port 80/443 for external web and mobile clients.
- Route `/api/auth/*` to Auth Service and `/api/products/*` to Product Service without path rewriting or `/v1` segments.
- Expose `/.well-known/jwks.json` directly from the Auth Service for public key distribution.
- Implement centralized CORS handling responding to `OPTIONS` preflight with `204 No Content` and applying unified CORS headers.
- Enforce anti-spoofing by stripping all client-supplied `X-User-*` headers while forwarding legitimate `Authorization` tokens and cookies.
- Expose upstream OpenAPI specs and interactive documentation (Swagger UI, Scalar UI) through `/docs/*` paths.
- Support container environment substitution via NGINX templates (`/etc/nginx/templates/default.conf.template`).

**Non-Goals:**
- Routing or exposing non-active/future services (only `auth`, `product`, and internal `redis` are active).
- Directly exposing `redis` over HTTP gateway (Redis is exclusively an internal container network dependency).
- Implementing gateway-level JWT signature verification via `auth_request` or NJS (downstream services verify tokens in-memory using cached JWKS).
- Managing database connections or business logic inside NGINX.
- Serving static frontend assets (static assets are handled by dedicated frontend containers or CDN).

## Decisions

### Decision 1: Gateway Pass-through for Authentication vs auth_request
- **Choice**: Gateway Pass-Through with Anti-Spoofing header sanitization.
- **Rationale**: `store_auth` uses RS256 asymmetric keys and publishes public keys at `/.well-known/jwks.json`. Making an NGINX `auth_request` subrequest per request creates an auth service bottleneck and network latency. Downstream microservices cache the JWKS in memory and verify tokens locally with 0ms overhead.
- **Alternatives Considered**:
  - *NGINX auth_request subrequest*: Rejected due to latency overhead and lack of dedicated `/auth/verify` endpoint.
  - *NJS RS256 JWT validation at gateway*: Rejected to keep the gateway lean and keep granular RBAC permissions evaluation inside respective domain services.

### Decision 2: URL Prefixing Convention (/api/auth, /api/products)
- **Choice**: Use `/api/auth/*` and `/api/products/*` without `/v1` segments.
- **Rationale**: Matches existing OpenAPI schemas in `store_auth` and `product_service`, as well as hardcoded security cookie scopes such as `Path=/api/auth/refresh`.
- **Alternatives Considered**:
  - *Versioning prefix `/api/v1/*`*: Rejected because downstream endpoints, test suites, and cookie paths are defined at `/api/auth/*`.

### Decision 3: Modular NGINX Configuration and Snippets
- **Choice**: Organize NGINX configurations into reusable snippets (`cors.conf`, `anti-spoofing.conf`, `proxy-params.conf`, `security-headers.conf`) and environment templates (`default.conf.template`).
- **Rationale**: Keeps configuration human-readable, testable, and maintainable. Allows tweaking CORS or security policies in one place without duplicating config across location blocks.
- **Alternatives Considered**:
  - *Monolithic single `nginx.conf`*: Rejected because it reduces maintainability and increases duplication.

### Decision 4: Docker Environment Substitution with NGINX Templates
- **Choice**: Leverage the official NGINX Docker image's built-in `envsubst` template support (`/etc/nginx/templates/*.template` to `/etc/nginx/conf.d/*.conf`).
- **Rationale**: Allows overriding upstream addresses (`AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `CORS_ALLOWED_ORIGINS`, `PORT`) seamlessly between Docker Compose environments, Kubernetes, and local host testing.

## Risks / Trade-offs

- **[Risk] Downstream services forgetting to verify tokens** → *Mitigation*: The gateway strips all `X-User-*` headers from incoming requests so downstreams can never be spoofed into trusting unverified client headers; downstreams must verify the `Authorization` JWT against cached JWKS.
- **[Risk] Upstream services emitting duplicate CORS headers** → *Mitigation*: Gateway acts as the single CORS authority. If upstream services also emit CORS headers, `proxy_hide_header` directives will prevent duplicate header browser errors.
- **[Risk] Upstream DNS resolution failure on dynamic IPs** → *Mitigation*: In Docker bridge networks, service names resolve via Docker embedded DNS (`127.0.0.11`).

## Migration & Deployment Plan

1. Build gateway Docker image with Alpine base.
2. Define environment variables in `.env` (`AUTH_SERVICE_URL=http://auth-service:8080`, `PRODUCT_SERVICE_URL=http://product-service:8040`, `GATEWAY_PORT=80`).
3. Connect gateway to shared bridge network (`store-network`).
4. Validate health and route forwarding using automated curl/integration tests.
