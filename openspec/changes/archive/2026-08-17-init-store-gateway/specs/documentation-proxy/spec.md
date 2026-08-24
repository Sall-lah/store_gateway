## ADDED Requirements

### Requirement: Route Auth Service Documentation
The API gateway SHALL proxy documentation requests for Auth Service Swagger UI at `/docs/auth` (and `/docs/auth/`) to the Auth Service documentation endpoint, and raw specification files at `/docs/auth/openapi.yaml`.

#### Scenario: Viewing Auth Service Swagger UI
- **WHEN** user navigates to `GET /docs/auth` in browser
- **THEN** gateway proxies request to `AUTH_SERVICE_URL/docs` returning the Swagger UI interface

#### Scenario: Fetching Auth Service OpenAPI YAML
- **WHEN** client requests `GET /docs/auth/openapi.yaml`
- **THEN** gateway proxies request to `AUTH_SERVICE_URL/docs/openapi.yaml` returning the OpenAPI 3.1 YAML document

### Requirement: Route Product Service Documentation
The API gateway SHALL proxy documentation requests for Product Service Scalar UI at `/docs/products/scalar` (or `/docs/products`), Swagger UI at `/docs/products/swagger`, and raw specification files at `/docs/products/openapi.json` and `/docs/products/openapi.yaml`.

#### Scenario: Viewing Product Service Scalar UI
- **WHEN** user navigates to `GET /docs/products/scalar` (or `GET /docs/products`)
- **THEN** gateway proxies request to `PRODUCT_SERVICE_URL/docs` returning the modern Scalar UI interface

#### Scenario: Viewing Product Service Swagger UI
- **WHEN** user navigates to `GET /docs/products/swagger`
- **THEN** gateway proxies request to `PRODUCT_SERVICE_URL/swagger` returning the Swagger UI interface

#### Scenario: Fetching Product Service OpenAPI JSON and YAML
- **WHEN** client requests `GET /docs/products/openapi.json` or `GET /docs/products/openapi.yaml`
- **THEN** gateway proxies request to `PRODUCT_SERVICE_URL/openapi.json` or `PRODUCT_SERVICE_URL/openapi.yaml` respectively
