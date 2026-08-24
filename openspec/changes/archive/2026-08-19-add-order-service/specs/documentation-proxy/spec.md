## ADDED Requirements

### Requirement: Route Order Service Documentation
The API gateway SHALL proxy documentation requests for Order Service Scalar UI at `/docs/orders/scalar` (and `/docs/orders`), Swagger UI at `/docs/orders/swagger`, and raw specification files at `/docs/orders/openapi.json` and `/docs/orders/openapi.yaml`.

#### Scenario: Viewing Order Service Scalar UI
- **WHEN** user navigates to `GET /docs/orders/scalar` (or `GET /docs/orders`)
- **THEN** gateway proxies request to `ORDER_SERVICE_URL/docs/` returning the modern Scalar UI interface

#### Scenario: Viewing Order Service Swagger UI
- **WHEN** user navigates to `GET /docs/orders/swagger`
- **THEN** gateway proxies request to `ORDER_SERVICE_URL/swagger/` returning the Swagger UI interface

#### Scenario: Fetching Order Service OpenAPI JSON and YAML
- **WHEN** client requests `GET /docs/orders/openapi.json` or `GET /docs/orders/openapi.yaml`
- **THEN** gateway proxies request to `ORDER_SERVICE_URL/docs/openapi.json` or `ORDER_SERVICE_URL/docs/openapi.yaml` respectively

## MODIFIED Requirements

### Requirement: Environment-Driven Documentation Availability
The API gateway SHALL evaluate the `ENABLE_DOCS` environment configuration at startup. When `ENABLE_DOCS` is disabled (`false` or `0`), all documentation endpoints (`/docs`, `/docs/auth/*`, `/docs/products/*`, `/docs/orders/*`) SHALL return HTTP 404 Not Found, while public key distribution (`/.well-known/jwks.json`) and API endpoints remain fully functional.

#### Scenario: Documentation enabled in development
- **WHEN** gateway runs with `ENABLE_DOCS=true` and client requests `GET /docs` or `GET /docs/orders/scalar`
- **THEN** gateway serves the documentation hub and proxies downstream UI documentation with HTTP 200

#### Scenario: Documentation disabled in production
- **WHEN** gateway runs with `ENABLE_DOCS=false` and client requests `GET /docs`, `GET /docs/auth`, `GET /docs/products/scalar`, `GET /docs/orders/scalar`, or raw spec files
- **THEN** gateway immediately returns HTTP 404 Not Found without forwarding requests downstream
