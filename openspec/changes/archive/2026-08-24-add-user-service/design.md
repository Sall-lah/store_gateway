## Context

`store_gateway` serves as the central reverse proxy and perimeter security gateway for the microservice ecosystem. Currently, it routes and secures traffic for `store_auth`, `product_service`, and `order_service`.

A new microservice, `user_service` (written in Go with Chi router, deployed in Podman at port 8082), manages user profiles, account lifecycle actions, in-app notifications, and notification preferences. Downstream `user_service` handlers rely on identity claims (`X-User-Id`, `X-User-Role`, `X-User-Email`) injected by `store_gateway` after perimeter token verification against `store_auth` (`/api/auth/me`).

## Goals / Non-Goals

**Goals:**
- Provide reverse proxy routing for `/api/users/*` and `/api/v1/users/*` (including exact matches `/api/users` and `/api/v1/users`) targeting `${USER_SERVICE_URL}/api/users/*`.
- Enforce full perimeter authentication offloading (`/_auth_verify`), anti-spoofing header sanitization, and verified user claim injection (`X-User-Id`, `X-User-Role`, `X-User-Email`) on all user endpoints.
- Proxy interactive Swagger documentation and raw OpenAPI schemas (`/docs/users`, `/docs/users/swagger`, `/docs/users/openapi.json`, `/docs/users/openapi.yaml`) with `ENABLE_DOCS` conditional gating.
- Update the central `/docs` HTML hub with links to User Service documentation.
- Introduce `USER_SERVICE_URL` environment configuration in `.env.example` and documentation.
- Add comprehensive automated test cases in `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs`.

**Non-Goals:**
- Modifying internal business logic, database schemas, or gRPC communication within `user_service`.
- Handling internal service-to-service gRPC traffic (e.g. `user_service` to `order_service` gRPC preflight checks), which communicates directly on the private network.
- Implementing local caching of user profiles at the gateway level.

## Decisions

### 1. Enforce Full Authentication Offloading on All User Routes
- **Decision**: Apply `snippets/auth-offload.conf` and `snippets/anti-spoofing.conf` to all `/api/users/*` and `/api/v1/users/*` routes.
- **Rationale**: Unlike `product_service` which permits public read access to catalog data, all `user_service` endpoints operate on user-scoped resources (personal profiles, notifications, preferences, account deletion). Therefore, every HTTP method (GET, PUT, PATCH, DELETE) requires a valid caller session verified by `store_auth`.
- **Alternatives Considered**: Mutation-only auth offload (`snippets/auth-offload-mutation.conf`). Rejected because `GET /api/users/profile` and `GET /api/users/notifications` must not be accessed anonymously.

### 2. Dual Routing for Versioned and Unversioned Paths
- **Decision**: Define explicit location blocks for `/api/users/`, `/api/users`, `/api/v1/users/`, and `/api/v1/users`, mapping all to `${USER_SERVICE_URL}/api/users/` (or `${USER_SERVICE_URL}/api/users`).
- **Rationale**: Aligns with existing gateway architecture across auth, products, and orders, offering consistent developer experience and forward compatibility.
- **Alternatives Considered**: Versioned only (`/api/v1/users/`). Rejected to maintain consistency with existing service path mappings.

### 3. Documentation Proxy Architecture & Hub Integration
- **Decision**:
  - Expose `/docs/users` and `/docs/users/swagger` proxying `${USER_SERVICE_URL}/swagger` (and `${USER_SERVICE_URL}/docs`).
  - Expose `/docs/users/openapi.json` and `/docs/users/openapi.yaml` proxying `${USER_SERVICE_URL}/docs/openapi.json` and `${USER_SERVICE_URL}/docs/openapi.yaml`.
  - Gate all documentation routes with the `$docs_disabled` variable (`if ($docs_disabled) { return 404; }`).
  - Add User Service entry to the `/docs` HTML directory.
- **Rationale**: Keeps documentation discoverable in development while respecting production disablement.

### 4. Configuration Via Environment Variable `USER_SERVICE_URL`
- **Decision**: Inject `${USER_SERVICE_URL}` dynamically using NGINX `envsubst` template processing.
- **Rationale**: Follows standard container configuration pattern used for `AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, and `ORDER_SERVICE_URL`.

## Risks / Trade-offs

- **[Subrequest Latency Overhead]** → Every user request triggers an internal subrequest to `store_auth` (`/api/auth/me`).
  - *Mitigation*: The subrequest is internal, uses keepalive connections (`snippets/proxy-params.conf`), and `store_auth` performs lightweight RS256 token verification or session lookups.
- **[Configuration Drift / Missing Env Var]** → If `USER_SERVICE_URL` is omitted, NGINX template substitution will result in empty upstream destinations.
  - *Mitigation*: Document `USER_SERVICE_URL` in `.env.example`, `README.md`, and test suites.

## Migration Plan

1. Update `nginx/templates/default.conf.template` with User Service routing blocks and documentation links.
2. Add `USER_SERVICE_URL` to `.env.example` and documentation.
3. Update automated test suites (`tests/gateway-spec.test.mjs`, `tests/auth-flow.test.mjs`) to verify routing, auth rejection, claim injection, and docs proxying.
4. Run test suite to validate syntax and behavior.
