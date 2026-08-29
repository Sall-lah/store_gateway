## Context

Downstream microservices (Auth, Product, Order, User) previously served documentation HTML hardcoded to root paths (`/docs/openapi.yaml`, `/openapi.json`), which required NGINX `sub_filter` string substitutions and `Accept-Encoding ""` header suppression in the API gateway. Now that all downstream services have updated their UI templates to use relative paths (`./openapi.yaml`, `./openapi.json`), the browser naturally resolves documentation requests relative to the gateway prefix (`/docs/auth/`, `/docs/products/scalar/`, `/docs/orders/`, `/docs/users/`).

## Goals / Non-Goals

**Goals:**
- Strip out all `sub_filter` and `proxy_set_header Accept-Encoding ""` directives from `nginx/templates/default.conf.template`.
- Remove temporary root fallback routes (`/docs/openapi.yaml`, `/openapi.json`).
- Ensure all automated unit and integration tests validate the clean, unencumbered proxy configuration.
- Rebuild the Docker image and restart the running Podman container.

**Non-Goals:**
- Changing upstream service endpoints or internal route logic.
- Modifying security, CORS, or authentication offloading policies.

## Decisions

### 1. Pure Pass-Through Documentation Proxying
- **Decision**: Remove `sub_filter` and `Accept-Encoding ""` header clearing from all documentation location blocks.
- **Why**: With relative URLs, browsers automatically query `/docs/<service>/<spec-file>`. Eliminating `sub_filter` avoids buffering HTML in memory and permits full upstream gzip/brotli compression.
- **Alternatives considered**: Keeping `sub_filter` as a backup (adds unnecessary complexity and prevents upstream compression).

### 2. Deletion of Root-Level Fallback Endpoints
- **Decision**: Remove `location = /docs/openapi.yaml` and `location = /openapi.json`.
- **Why**: Fallback routes like `/openapi.json` were ambiguous (they defaulted to Product Service, ignoring Auth/Order/User). Removing them enforces clean namespace isolation.
- **Alternatives considered**: Keeping fallbacks (confuses multi-service schema discovery).

## Risks / Trade-offs

- **[Risk] Cached browser sessions with old HTML**:
  - Mitigation: Browser HTTP cache for HTML documents is transient or can be cleared with hard refresh (Ctrl+F5). Gateway redirects (`/docs/auth` ➔ `/docs/auth/`) ensure relative URLs always anchor with the necessary trailing slash.

## Migration Plan

1. Edit `nginx/templates/default.conf.template` to remove `sub_filter` and fallback blocks.
2. Update `tests/gateway-spec.test.mjs` test assertions.
3. Run `npm test` to verify suite integrity.
4. Synchronize delta spec to main spec.
5. Rebuild Podman image and restart `store_gateway` container.
