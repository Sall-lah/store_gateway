## Context

`store_gateway` is the centralized entry point and reverse proxy for the store microservice ecosystem. Currently, it routes traffic to `auth-service` (port 8080) and `product-service` (port 8040), handling trace ID injection, CORS, header sanitization, token validation via subrequests, and unified documentation proxies.

With the introduction of the new Order Service (port 8060, supporting Scalar UI, Swagger UI, OpenAPI JSON/YAML), the gateway needs to integrate order routing, standardize API versioning (`v1`) across all microservices, extend perimeter authentication offloading to orders, and remove `docker-compose.yml` to support standalone service deployment architectures.

## Goals / Non-Goals

**Goals:**
- Provide reverse-proxy routing for Order Service endpoints (`/api/orders/*` and `/api/v1/orders/*` mapped to `${ORDER_SERVICE_URL}/api/v1/orders/*`).
- Standardize versioned (`/api/v1/<service>/*`) and backward-compatible unversioned (`/api/<service>/*`) routes across Auth, Product, and Order services.
- Apply gateway authentication offloading (`snippets/auth-offload.conf`) to Order Service mutating operations, forwarding verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers.
- Expose Order Service documentation endpoints (`/docs/orders/scalar`, `/docs/orders/swagger`, `/docs/orders/openapi.json`, `/docs/orders/openapi.yaml`) and update the `/docs` documentation hub landing page.
- Ensure all documentation routes respect the `ENABLE_DOCS` toggle.
- Remove `docker-compose.yml` and provide clean standalone Docker execution instructions.
- Update automated test suites to validate order routing, authentication offload, and documentation proxying.

**Non-Goals:**
- Modifying business logic or internal implementations of downstream services (`order-service`, `auth-service`, `product-service`).
- Implementing Redis-backed rate limiting or gateway-level response caching in this change.

## Decisions

### Decision 1: Dual Path Aliasing with Standardized Upstream `v1` (Pattern 2)
- **Choice**: The gateway will accept both `/api/<service>/*` and `/api/v1/<service>/*`, routing both to `${<SERVICE>_URL}/api/v1/<service>/*` upstream (and `${AUTH_SERVICE_URL}/api/v1/auth/*` or `${AUTH_SERVICE_URL}/api/auth/*` for auth service).
- **Rationale**: Provides a consistent `v1` standard across modern client calls while maintaining seamless compatibility with unversioned legacy endpoints.
- **Alternatives Considered**: Direct pass-through without version rewriting was rejected because it causes inconsistent path conventions across different microservices.

### Decision 2: Perimeter Authentication Offloading on Order Endpoints
- **Choice**: Include `snippets/auth-offload.conf` in Order Service location blocks.
- **Rationale**: Standardizes security enforcement at the gateway perimeter, offloading cryptographic JWT validation from downstream services and ensuring `X-User-*` claims are cryptographically verified before reaching the Order Service.
- **Alternatives Considered**: In-service JWKS validation was rejected to keep service-level logic decoupled from token decoding and to maintain defense-in-depth perimeter sanitization.

### Decision 3: Documentation Hub & Proxy Architecture
- **Choice**: Proxy `/docs/orders/scalar/` to `${ORDER_SERVICE_URL}/docs/`, `/docs/orders/swagger/` to `${ORDER_SERVICE_URL}/swagger/`, `/docs/orders/openapi.json` to `${ORDER_SERVICE_URL}/docs/openapi.json`, and `/docs/orders/openapi.yaml` to `${ORDER_SERVICE_URL}/docs/openapi.yaml`.
- **Rationale**: Mirrors the Product Service doc layout and matches the Order Service's native doc endpoints, unified under the gateway's `/docs` index.
- **Alternatives Considered**: Hardcoded single Scalar UI was rejected because developers require both classic Swagger and raw OpenAPI spec downloads.

### Decision 4: Standalone Deployment Model
- **Choice**: Remove `docker-compose.yml` and configure environment variables in `.env.example` for independent deployment (standalone Docker container, Kubernetes Pod, or bare metal).
- **Rationale**: Aligns with the project requirement to allow individual deployment and lifecycle management of microservices.

## Risks / Trade-offs

- **[Risk] Path Trailing Slash Redirection in NGINX**: NGINX `proxy_pass` URI replacement requires careful trailing slash alignment to avoid duplicating or omitting path segments.
  - *Mitigation*: Define exact matches and trailing slash location blocks consistently across all services (`/api/orders/`, `/api/orders`, `/api/v1/orders/`, `/api/v1/orders`).
- **[Risk] Auth Subrequest Latency**: Auth offload calls an internal subrequest for mutating endpoints.
  - *Mitigation*: Subrequests reuse existing HTTP keepalive connections and execute in-memory on the auth service.

## Migration Plan

1. Update `.env.example` and `.env` with `ORDER_SERVICE_URL`.
2. Update `nginx/templates/default.conf.template` with order routing, versioning aliases, and doc proxies.
3. Remove `docker-compose.yml`.
4. Update test suites (`tests/gateway-spec.test.mjs`, `tests/auth-flow.test.mjs`) to verify all new routes and behaviors.
5. Update `README.md` with architecture diagrams, route tables, and standalone run instructions.
