## Why

The microservice ecosystem is expanding with the introduction of a new Order Service (`ORDER_SERVICE_URL`, port 8060). To provide a unified, secure, and standardized API entry point, the gateway must route order requests, support consistent API versioning (`v1`) across all microservices, proxy order API documentation portals (Scalar, Swagger, OpenAPI JSON/YAML), enforce perimeter authentication offloading, and support standalone service deployments by removing `docker-compose.yml`.

## What Changes

- **Order Service Reverse Proxy Routing**: Route `/api/orders/*` and `/api/v1/orders/*` to upstream `${ORDER_SERVICE_URL}/api/v1/orders/*`.
- **Unified API Versioning (`v1`)**: Standardize routing across all services (Auth, Product, Order) to support both unversioned (`/api/<service>/*`) and versioned (`/api/v1/<service>/*`) gateway endpoints mapping to upstream `/api/v1/<service>/*`.
- **Order Service Auth Offloading**: Apply perimeter authentication offloading (`snippets/auth-offload.conf`) to Order Service endpoints to inject verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers for downstream processing.
- **Order Service Documentation Proxy**: Expose Scalar UI (`/docs/orders/scalar`), Swagger UI (`/docs/orders/swagger`), and raw OpenAPI specs (`/docs/orders/openapi.json`, `/docs/orders/openapi.yaml`) conditionally via `ENABLE_DOCS`, and update the `/docs` documentation hub.
- **Standalone Deployment Scaffolding**: Remove `docker-compose.yml` to allow individual container/service deployments, and update environment configuration (`.env.example`) and deployment documentation.

## Capabilities

### New Capabilities
<!-- No brand new capability domains; changes update existing gateway capabilities. -->

### Modified Capabilities
- `api-routing`: Route `/api/orders/*` and `/api/v1/orders/*` to the Order Service, and standardize `v1` upstream routing across Auth, Product, and Order services.
- `documentation-proxy`: Proxy Order Service documentation interfaces (Scalar UI, Swagger UI, OpenAPI specs) and include Order Service in the unified `/docs` hub.
- `auth-offloading`: Enforce gateway authentication verification and claim injection for Order Service mutating endpoints.

## Impact

- **NGINX Template**: Updates to `nginx/templates/default.conf.template` for order routing, versioning aliases, and documentation blocks.
- **Environment Configuration**: Addition of `ORDER_SERVICE_URL` in `.env.example` and `.env`.
- **Deployment Scaffolding**: Removal of `docker-compose.yml` in favor of standalone Docker container runs.
- **Automated Tests**: Updates to `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs` to test order routing, auth offloading, and doc proxies.
- **Documentation**: Updates to `README.md` reflecting new routes and standalone deployment commands.
