## Why

Now that downstream microservices (Auth, Product, Order, and User) serve their interactive Swagger and Scalar documentation bundles with relative paths (`./openapi.yaml`, `./openapi.json`), NGINX in-flight HTML string replacement (`sub_filter`) and `Accept-Encoding ""` header stripping are no longer necessary. Removing these directives simplifies the gateway routing pipeline, restores upstream response compression support, and eliminates temporary root-level fallback routes.

## What Changes

- **REMOVAL**: Remove `sub_filter` rewriting rules from `nginx/templates/default.conf.template` across Auth, Product, Order, and User documentation locations.
- **REMOVAL**: Remove `proxy_set_header Accept-Encoding ""` from documentation proxy locations, restoring native upstream content compression.
- **REMOVAL**: Remove root-level fallback routes (`location = /docs/openapi.yaml` and `location = /openapi.json`), strictly scoping specs to `/docs/<service>/...`.
- **MODIFICATION**: Update `openspec/specs/documentation-proxy/spec.md` to specify direct relative path resolution rather than active HTML rewriting.
- **MODIFICATION**: Update unit test assertions in `tests/gateway-spec.test.mjs` to verify clean pass-through routing without `sub_filter`.
- **CONTAINER**: Rebuild and redeploy the `store_gateway` container in Podman.

## Capabilities

### New Capabilities
*(None)*

### Modified Capabilities
- `documentation-proxy`: Updates documentation proxy requirements from gateway `sub_filter` rewriting to direct upstream relative path resolution and removes root-level fallbacks.

## Impact

- **Affected Code**: `nginx/templates/default.conf.template`, `tests/gateway-spec.test.mjs`.
- **Specifications**: `openspec/specs/documentation-proxy/spec.md`.
- **Deployment**: `store_gateway` container recreation on `store-network`.
