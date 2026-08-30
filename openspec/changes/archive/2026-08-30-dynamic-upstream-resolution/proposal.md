## Why

When upstream backend services (`auth-service`, `product-service`, `order-service`, `user-service`) are restarted or redeployed, Docker assigns new IP addresses on the bridge network and updates its internal DNS (`127.0.0.11`). Because NGINX currently resolves upstream hostnames statically at startup, it permanently caches stale IP addresses, causing subsequent API calls to fail with `502 Bad Gateway` until the gateway container itself is manually restarted. Enabling runtime dynamic DNS resolution decouples the gateway from static container IPs and eliminates the need to restart the gateway after upstream deployments.

## What Changes

- Configure NGINX runtime DNS `resolver` targeting Docker's embedded DNS server (`127.0.0.11` by default, configurable via `DNS_RESOLVER` env var) with a short cache TTL (`valid=5s ipv6=off;`).
- Transition `proxy_pass` upstream declarations in `nginx/templates/default.conf.template` to use NGINX runtime variables (`$auth_backend`, `$product_backend`, `$order_backend`, `$user_backend`) so NGINX executes dynamic DNS resolution instead of one-time boot-time caching.
- Standardize URI path propagation across versioned and legacy alias routes using explicit URI rewrites and `$request_uri` variable passing to preserve exact query parameters and request payloads.
- Update `Dockerfile` environment variables and `NGINX_ENVSUBST_FILTER` to expose `DNS_RESOLVER` with a default of `127.0.0.11`.
- Update automated contract tests in `tests/gateway-spec.test.mjs` to validate dynamic resolver directives, variable-based proxy routing, and environment variable substitutions.

## Capabilities

### New Capabilities
<!-- No brand new standalone capabilities; this enhances existing routing infrastructure -->

### Modified Capabilities
- `api-routing`: Upstream reverse-proxy routing will dynamically resolve service hostnames at runtime via NGINX resolver instead of static startup-only IP caching, ensuring resilience across upstream container restarts.

## Impact

- **Affected Files**:
  - `Dockerfile`: Add `DNS_RESOLVER=127.0.0.11` and include it in `NGINX_ENVSUBST_FILTER`.
  - `.env.example`: Add optional `DNS_RESOLVER` configuration with explanation.
  - `nginx/templates/default.conf.template`: Add `resolver` directive, define upstream variables, and update `proxy_pass` blocks with appropriate URI handling.
  - `tests/gateway-spec.test.mjs`: Update route template assertions and add tests for dynamic resolver configuration.
- **APIs and Downstream Services**: Zero breaking changes to public APIs, clients, or backend microservices.
- **Dependencies**: No external npm or Alpine packages needed; uses built-in NGINX `resolver` directive.
