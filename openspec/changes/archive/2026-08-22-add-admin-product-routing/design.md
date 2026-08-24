# Design: Admin Product Routing

## Context

`store_gateway` acts as the single reverse proxy for the microservice ecosystem, handling authentication offloading, anti-spoofing, and CORS. Following the separation of product management into public catalog endpoints (`/api/products`) and administrative backoffice endpoints (`/api/admin/products`), the gateway needs corresponding reverse-proxy location blocks and authentication policies to route and protect these administrative endpoints.

## Goals / Non-Goals

**Goals:**
- Provide reverse-proxy routing for `/api/admin/products/`, `/api/admin/products`, `/api/v1/admin/products/`, and `/api/v1/admin/products` to `${PRODUCT_SERVICE_URL}/api/v1/admin/products/`.
- Enforce full perimeter authentication offloading (`auth-offload.conf`) across all HTTP methods on admin product endpoints (rejecting unauthenticated requests with HTTP 401 Unauthorized before forwarding to upstream).
- Apply anti-spoofing header sanitization (`anti-spoofing.conf`), CORS preflight handling (`cors.conf`), and proxy parameters (`proxy-params.conf`) with verified claim injection (`X-User-Id`, `X-User-Role`, `X-User-Email`).
- Expand automated unit and integration tests to verify admin product routing, auth offloading, and mock upstream interaction.

**Non-Goals:**
- Implementing fine-grained RBAC permission checks at the gateway layer (role authorization is handled downstream by `product_service` using the gateway-injected `X-User-Role`).
- Modifying existing public catalog `/api/products` routing or mutation-only auth behavior.

## Decisions

### Decision 1: Full Auth Offload vs. Mutation-Only for Admin Product Routes
- **Chosen Option**: Apply Full Auth Offload (`auth-offload.conf` using `/_auth_verify`).
- **Rationale**: Administrative product queries (`GET /api/v1/admin/products`) expose sensitive data (e.g. unlisted drafts, stock levels, wholesale costs, supplier info) and must not be publicly accessible. All HTTP methods must be authenticated, identical to `/api/v1/admin/orders`.
- **Alternatives Considered**: Mutation-only auth (`auth-offload-mutation.conf`) was rejected because it would expose internal admin product listings to anonymous callers.

### Decision 2: Routing Paths and Aliases
- **Chosen Option**: Define location blocks for both `/api/v1/admin/products/` and legacy/unversioned `/api/admin/products/`, matching the pattern established for `/api/admin/orders/`.
- **Rationale**: Maintains routing consistency across all microservices and backward-compatibility with client aliases.
- **Alternatives Considered**: Supporting only `/api/v1/admin/products` was rejected to avoid breaking clients using unversioned prefixes.

### Decision 3: Upstream Target Path
- **Chosen Option**: Proxy to `${PRODUCT_SERVICE_URL}/api/v1/admin/products/`.
- **Rationale**: Follows standard REST v1 API versioning inside `product_service`.

## Risks / Trade-offs

- **[Risk] Downstream path mismatch**: If `product_service` mounts admin endpoints at `/api/admin/products` instead of `/api/v1/admin/products`.
  - *Mitigation*: Standardize downstream targets on `/api/v1/admin/products` matching the established conventions across Auth and Order services.
- **[Risk] Performance overhead from auth subrequests**: Every admin request requires an internal subrequest to Auth Service.
  - *Mitigation*: Internal subrequests are executed over fast local network connections with minimal latency overhead, and admin traffic volume is significantly lower than public catalog browsing.
