## Context

The microservice architecture relies on Gateway Authentication Offloading: the gateway (`store_gateway`) acts as the security perimeter, verifying client tokens and injecting verified user claims (`X-User-Id`, `X-User-Role`) for downstream microservices like `store_product`.

Currently, `store_gateway` only strips client headers without verifying the caller or injecting verified headers, resulting in `403 Forbidden` errors on protected operations.

```
                    CLIENT
                      │  Authorization: Bearer <JWT> or Cookie
                      ▼
       ┌───────────────────────────────┐
       │     STORE_GATEWAY (NGINX)     │
       ├───────────────────────────────┤
       │ 1. auth_request /_auth_verify │──────┐
       │ 2. Extract verified headers   │      │
       │ 3. Inject X-User-*            │      │ Subrequest
       └──────────────┬────────────────┘      ▼
                      │              ┌──────────────────┐
                      │              │   STORE_AUTH     │
                      │              │  /api/auth/me    │
                      │              └──────────────────┘
                      │ Injected:
                      │ • X-User-Id: usr_...
                      │ • X-User-Role: ADMIN
                      ▼
       ┌───────────────────────────────┐
       │        STORE_PRODUCT          │
       │ Reads req.Header(X-User-Role) │
       └───────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Implement NGINX `auth_request` subrequest to verify user authentication with `store_auth` on protected routes.
- Extract `X-User-Id`, `X-User-Role`, and `X-User-Email` from the auth subrequest response and inject them into downstream proxy requests.
- Block unauthenticated or invalid mutating requests at the gateway with `401 Unauthorized`.
- Ensure public endpoints (`GET /api/products`, `/docs`, `/health`) bypass mandatory authentication checks.

**Non-Goals:**
- Rewriting NGINX with Envoy or Kong.
- Modifying `store_auth` RS256 token signing mechanics.

## Decisions

### Decision 1: Use NGINX Built-in `auth_request` Module
- **Choice**: Use standard NGINX `http_auth_request_module` (included by default in NGINX Alpine).
- **How it works**:
  1. An internal location `location = /_auth_verify` proxies the client's `Authorization` header and cookies to `${AUTH_SERVICE_URL}/api/auth/me`.
  2. `store_auth` responds with `200 OK` and response headers (`X-User-Id`, `X-User-Role`, `X-User-Email`).
  3. NGINX captures these headers with `auth_request_set $auth_user_id $upstream_http_x_user_id;` and injects them to downstream services via `proxy_set_header X-User-Id $auth_user_id;`.
- **Alternatives Considered**:
  - *NJS / Lua Module*: Requires custom image build and JS scripts; `auth_request` is native, battle-tested, and simpler to maintain.

### Decision 2: Distinct Public vs Protected Location Blocks
- **Choice**: Define dedicated locations or method-specific routing in `default.conf.template`:
  - `GET /api/products` (and public read routes) use anonymous pass-through.
  - `POST /api/products`, `PUT /api/products/*`, `DELETE /api/products/*` enforce `auth_request /_auth_verify;`.

## Risks / Trade-offs

- **[Risk] Auth subrequest latency** → Mitigation: Auth check against `/api/auth/me` is an in-memory token verification occurring over the local Docker network (< 2ms).
- **[Risk] Header leakage from client** → Mitigation: `anti-spoofing.conf` clears all client headers before `auth_request_set` populates verified values.
