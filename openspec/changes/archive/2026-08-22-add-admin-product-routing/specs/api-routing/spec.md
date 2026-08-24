# API Routing Delta Specification

## ADDED Requirements

### Requirement: Route Admin Product Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/admin/products/` and `/api/admin/products/` (and exact paths `/api/v1/admin/products`, `/api/admin/products`) to the upstream Product Service (`${PRODUCT_SERVICE_URL}/api/v1/admin/products/` or `/api/v1/admin/products`) while applying CORS, anti-spoofing sanitization, full authentication offloading (`/_auth_verify`), and proxy headers across all HTTP methods.

#### Scenario: Admin querying product catalog
- **WHEN** client sends `GET /api/v1/admin/products` with valid admin authentication credentials
- **THEN** gateway verifies the token with Auth Service, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies request to `${PRODUCT_SERVICE_URL}/api/v1/admin/products`, and returns HTTP 200 response

#### Scenario: Admin creating a new product
- **WHEN** client sends `POST /api/v1/admin/products` with JSON payload and valid admin credentials
- **THEN** gateway verifies token, passes request body and verified headers to `${PRODUCT_SERVICE_URL}/api/v1/admin/products`, and returns upstream response

#### Scenario: Unauthenticated admin product request rejected at perimeter
- **WHEN** client sends `GET /api/v1/admin/products` or `POST /api/v1/admin/products` without credentials or with an invalid token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized before forwarding downstream
