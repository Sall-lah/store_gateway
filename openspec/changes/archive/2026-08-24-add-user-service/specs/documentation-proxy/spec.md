## ADDED Requirements

### Requirement: Route User Service Documentation
The API gateway SHALL proxy documentation requests for User Service Swagger UI at `/docs/users` and `/docs/users/swagger` (redirecting or proxying to `${USER_SERVICE_URL}/swagger` / `${USER_SERVICE_URL}/docs`), and raw specification files at `/docs/users/openapi.json` and `/docs/users/openapi.yaml` to `${USER_SERVICE_URL}/docs/openapi.json` and `${USER_SERVICE_URL}/docs/openapi.yaml`.

#### Scenario: Viewing User Service Swagger UI
- **WHEN** user navigates to `GET /docs/users` or `GET /docs/users/swagger`
- **THEN** gateway proxies request to `${USER_SERVICE_URL}/swagger` (or `/docs`) returning the Swagger UI interactive interface

#### Scenario: Fetching User Service OpenAPI JSON and YAML
- **WHEN** client requests `GET /docs/users/openapi.json` or `GET /docs/users/openapi.yaml`
- **THEN** gateway proxies request to `${USER_SERVICE_URL}/docs/openapi.json` or `${USER_SERVICE_URL}/docs/openapi.yaml` respectively

## MODIFIED Requirements

### Requirement: Environment-Driven Documentation Availability
The API gateway SHALL evaluate the `ENABLE_DOCS` environment configuration at startup. When `ENABLE_DOCS` is disabled (`false`, `0`, or `off`), all documentation endpoints (`/docs`, `/docs/auth/*`, `/docs/products/*`, `/docs/orders/*`, `/docs/users/*`) SHALL return HTTP 404 Not Found immediately, while public key distribution (`/.well-known/jwks.json`) and API routes remain active.

#### Scenario: Documentation enabled in development
- **WHEN** gateway runs with `ENABLE_DOCS=true` and client requests `GET /docs`, `GET /docs/products/scalar`, `GET /docs/orders/scalar`, or `GET /docs/users/swagger`
- **THEN** gateway serves the documentation hub HTML at `/docs` and proxies downstream UI documentation with HTTP 200

#### Scenario: Documentation disabled in production
- **WHEN** gateway runs with `ENABLE_DOCS=false` (or `0` or `off`) and client requests any `/docs*` endpoint
- **THEN** gateway immediately returns HTTP 404 Not Found without forwarding requests downstream
