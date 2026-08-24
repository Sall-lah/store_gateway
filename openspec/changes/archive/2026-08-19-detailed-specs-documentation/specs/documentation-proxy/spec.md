## MODIFIED Requirements

### Requirement: Route Auth Service Documentation
The API gateway SHALL proxy documentation requests for Auth Service Swagger UI at `/docs/auth` (with 302 redirect to `/docs/auth/`) and `/docs/auth/` to `${AUTH_SERVICE_URL}/docs/`, and raw specification files at `/docs/auth/openapi.yaml` to `${AUTH_SERVICE_URL}/docs/openapi.yaml`.

#### Scenario: Viewing Auth Service Swagger UI
- **WHEN** user navigates to `GET /docs/auth` in browser
- **THEN** gateway responds with HTTP 302 redirecting to `/docs/auth/`, which proxies request to `${AUTH_SERVICE_URL}/docs/` returning the Swagger UI interface

#### Scenario: Fetching Auth Service OpenAPI YAML
- **WHEN** client requests `GET /docs/auth/openapi.yaml`
- **THEN** gateway proxies request to `${AUTH_SERVICE_URL}/docs/openapi.yaml` returning the OpenAPI YAML document

### Requirement: Route Product Service Documentation
The API gateway SHALL proxy documentation requests for Product Service Scalar UI at `/docs/products` and `/docs/products/scalar` (redirecting to `/docs/products/scalar/`) to `${PRODUCT_SERVICE_URL}/docs/`, Swagger UI at `/docs/products/swagger` (redirecting to `/docs/products/swagger/`) to `${PRODUCT_SERVICE_URL}/swagger/`, and raw specification files at `/docs/products/openapi.json` and `/docs/products/openapi.yaml` to `${PRODUCT_SERVICE_URL}/openapi.json` and `${PRODUCT_SERVICE_URL}/openapi.yaml`.

#### Scenario: Viewing Product Service Scalar UI
- **WHEN** user navigates to `GET /docs/products` or `GET /docs/products/scalar`
- **THEN** gateway redirects to `/docs/products/scalar/` and proxies request to `${PRODUCT_SERVICE_URL}/docs/` returning the Scalar UI interface

#### Scenario: Viewing Product Service Swagger UI
- **WHEN** user navigates to `GET /docs/products/swagger`
- **THEN** gateway redirects to `/docs/products/swagger/` and proxies request to `${PRODUCT_SERVICE_URL}/swagger/` returning the Swagger UI interface

#### Scenario: Fetching Product Service OpenAPI JSON and YAML
- **WHEN** client requests `GET /docs/products/openapi.json` or `GET /docs/products/openapi.yaml`
- **THEN** gateway proxies request to `${PRODUCT_SERVICE_URL}/openapi.json` or `${PRODUCT_SERVICE_URL}/openapi.yaml` respectively

### Requirement: Route Order Service Documentation
The API gateway SHALL proxy documentation requests for Order Service Scalar UI at `/docs/orders` and `/docs/orders/scalar` to `${ORDER_SERVICE_URL}/docs`, Swagger UI at `/docs/orders/swagger` to `${ORDER_SERVICE_URL}/swagger`, and raw specification files at `/docs/orders/openapi.json` and `/docs/orders/openapi.yaml` to `${ORDER_SERVICE_URL}/docs/openapi.json` and `${ORDER_SERVICE_URL}/docs/openapi.yaml`.

#### Scenario: Viewing Order Service Scalar UI
- **WHEN** user navigates to `GET /docs/orders` or `GET /docs/orders/scalar`
- **THEN** gateway proxies request to `${ORDER_SERVICE_URL}/docs` returning the modern Scalar UI interface

#### Scenario: Viewing Order Service Swagger UI
- **WHEN** user navigates to `GET /docs/orders/swagger`
- **THEN** gateway proxies request to `${ORDER_SERVICE_URL}/swagger` returning the Swagger UI interface

#### Scenario: Fetching Order Service OpenAPI JSON and YAML
- **WHEN** client requests `GET /docs/orders/openapi.json` or `GET /docs/orders/openapi.yaml`
- **THEN** gateway proxies request to `${ORDER_SERVICE_URL}/docs/openapi.json` or `${ORDER_SERVICE_URL}/docs/openapi.yaml` respectively

### Requirement: Environment-Driven Documentation Availability
The API gateway SHALL evaluate the `ENABLE_DOCS` environment configuration at startup. When `ENABLE_DOCS` is disabled (`false`, `0`, or `off`), all documentation endpoints (`/docs`, `/docs/auth/*`, `/docs/products/*`, `/docs/orders/*`) SHALL return HTTP 404 Not Found immediately, while public key distribution (`/.well-known/jwks.json`) and API routes remain active.

#### Scenario: Documentation enabled in development
- **WHEN** gateway runs with `ENABLE_DOCS=true` and client requests `GET /docs`, `GET /docs/products/scalar`, or `GET /docs/orders/scalar`
- **THEN** gateway serves the documentation hub HTML at `/docs` and proxies downstream UI documentation with HTTP 200

#### Scenario: Documentation disabled in production
- **WHEN** gateway runs with `ENABLE_DOCS=false` (or `0` or `off`) and client requests any `/docs*` endpoint
- **THEN** gateway immediately returns HTTP 404 Not Found without forwarding requests downstream
