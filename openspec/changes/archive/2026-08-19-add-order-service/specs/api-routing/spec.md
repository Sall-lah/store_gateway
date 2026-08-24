## MODIFIED Requirements

### Requirement: Route Auth Service Requests
The API gateway SHALL reverse-proxy all incoming requests with prefix `/api/auth/` and `/api/v1/auth/` to the upstream Auth Service (`AUTH_SERVICE_URL`) at `/api/v1/auth/` while preserving the full path, query parameters, request headers, body, and client IP addresses.

#### Scenario: Forwarding user registration request
- **WHEN** client sends a `POST /api/v1/auth/register` or `POST /api/auth/register` with JSON body
- **THEN** gateway forwards the request to `AUTH_SERVICE_URL/api/v1/auth/register` preserving headers and body, and returns the upstream response to the client

#### Scenario: Forwarding refresh token cookie
- **WHEN** client sends a `POST /api/v1/auth/refresh` or `POST /api/auth/refresh` containing a `refresh_token` cookie
- **THEN** gateway passes the cookie to `AUTH_SERVICE_URL/api/v1/auth/refresh` and forwards `Set-Cookie` response headers back to the client

### Requirement: Route Product Service Requests
The API gateway SHALL reverse-proxy all incoming requests with prefix `/api/products/` and `/api/v1/products/` to the upstream Product Service (`PRODUCT_SERVICE_URL`) at `/api/v1/products/` while preserving the path, query parameters, authorization headers, body, and injecting verified `X-User-Id` and `X-User-Role` headers for authenticated operations.

#### Scenario: Fetching product catalog
- **WHEN** client sends `GET /api/products?page=1&limit=20` or `GET /api/v1/products?page=1&limit=20`
- **THEN** gateway forwards the request to `PRODUCT_SERVICE_URL/api/v1/products?page=1&limit=20` anonymously and returns the product listing response

#### Scenario: Creating a product with authorization token
- **WHEN** client sends `POST /api/v1/products` with `Authorization: Bearer <jwt>` and product payload
- **THEN** gateway verifies the token, injects verified `X-User-Id` and `X-User-Role` headers along with the payload to `PRODUCT_SERVICE_URL/api/v1/products`, and returns the upstream response

## ADDED Requirements

### Requirement: Route Order Service Requests
The API gateway SHALL reverse-proxy all incoming requests with prefix `/api/orders/` and `/api/v1/orders/` to the upstream Order Service (`ORDER_SERVICE_URL`) at `/api/v1/orders/` while applying centralized CORS, anti-spoofing header sanitization, auth offloading, and proxy header forwarding.

#### Scenario: Creating an order with authenticated token
- **WHEN** client sends `POST /api/v1/orders` (or `POST /api/orders`) with `Authorization: Bearer <jwt>` and order payload
- **THEN** gateway validates credentials against the auth verification subrequest, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies the request to `ORDER_SERVICE_URL/api/v1/orders`, and returns the upstream response

#### Scenario: Fetching order details
- **WHEN** client sends `GET /api/v1/orders/123` (or `GET /api/orders/123`)
- **THEN** gateway forwards the request to `ORDER_SERVICE_URL/api/v1/orders/123` preserving query parameters, trace ID, and proxy parameters, and returns the upstream response
