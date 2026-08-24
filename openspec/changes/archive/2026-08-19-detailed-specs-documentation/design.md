## Context

The `store_gateway` repository acts as the primary API Gateway and reverse proxy for the microservice ecosystem (Auth Service on port 8080, Product Service on port 8040, and Order Service on port 8060). Built on a lightweight Alpine-based NGINX container, it centralizes cross-cutting concerns:
- Dynamic reverse proxy routing (`/api/v1/auth/*`, `/api/v1/products/*`, `/api/v1/orders/*`, and backward-compatible aliases).
- Perimeter authentication offloading via internal subrequests (`/_auth_verify` and `/_auth_verify_mutation_only`).
- Anti-spoofing header sanitization (stripping client-supplied `X-User-*` headers).
- Centralized CORS handling (OPTIONS 204 preflight with 24-hour cache and upstream duplicate header suppression).
- Unified documentation proxying (Scalar UI, Swagger UI, raw OpenAPI JSON/YAML schemas) with environment toggle (`ENABLE_DOCS`).
- Distributed request tracing (`X-Request-ID`) and baseline security headers.

To maintain high maintainability and clarity across development teams, the OpenSpec specifications and `README.md` must be thoroughly documented with complete technical precision.

## Goals / Non-Goals

**Goals:**
- Provide complete, granular OpenSpec requirements across all 5 capability domains (`api-routing`, `auth-offloading`, `cors-management`, `documentation-proxy`, `security-headers`).
- Detail exact request/response header interactions, status codes, query parameter handling, and subrequest claim extraction semantics.
- Update `README.md` with sequence diagrams, comprehensive route and auth policy tables, complete environment variable dictionaries, and verification curl commands.
- Ensure all specifications and documentation match existing automated test assertions in `tests/`.

**Non-Goals:**
- Modifying the underlying NGINX routing logic or introducing new microservices.
- Adding complex in-gateway rate limiting or caching layers (reserved for future iterations).

## Decisions

### Decision 1: Specification-to-Code Parity
- **Rationale**: The OpenSpec specifications serve as the single source of truth for downstream service integration. Every requirement must define exact HTTP methods, headers, query preservation, and HTTP status codes (e.g., 200, 204, 302, 401, 404).
- **Alternatives Considered**: Keeping specifications high-level. Rejected because ambiguity leads to bugs in downstream microservice implementations and auth integration.

### Decision 2: Distinct Auth Offload Specifications
- **Rationale**: Product Service requires mutation-only authentication (GET/HEAD allowed publicly, POST/PUT/DELETE protected), while Order Service requires full authentication on all endpoints. The specifications explicitly distinguish between `/_auth_verify` and `/_auth_verify_mutation_only`.
- **Alternatives Considered**: Requiring authentication for all Product endpoints. Rejected to preserve public catalog access for unauthenticated storefront visitors.

### Decision 3: Granular Documentation Proxy Architecture
- **Rationale**: Different microservices use different documentation engines (Auth uses Swagger UI, Product and Order use both modern Scalar UI and classic Swagger UI). The documentation proxy spec details the exact proxy mapping, trailing slash redirects (302), and raw OpenAPI schema distribution paths.
- **Alternatives Considered**: Standardizing on a single documentation UI across all services. Rejected because downstream services maintain autonomy over their preferred API documentation engine.

### Decision 4: Centralized CORS and Anti-Spoofing Guarantees
- **Rationale**: Downstream microservices must never handle CORS preflights or trust client `X-User-*` headers directly. The gateway handles preflight caching (`Access-Control-Max-Age: 86400`) and suppresses upstream duplicate CORS headers (`proxy_hide_header`). Anti-spoofing ensures only the gateway's subrequest can inject authentic user claims.

## Risks / Trade-offs

- **[Risk] Specification Drift**: Detailed specifications could drift if NGINX configurations change without updating specs.
  - **Mitigation**: The test suite in `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs` tests both configuration syntax and live contract behavior against these specifications.
- **[Trade-off] Detailed Delta Specs Length**: More verbose specifications require additional reading time.
  - **Mitigation**: Clear scenario headers (`#### Scenario: ...`) and structured tables in `README.md` ensure quick reference for developers.
