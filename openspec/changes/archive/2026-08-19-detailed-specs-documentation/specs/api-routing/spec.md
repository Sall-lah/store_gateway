## MODIFIED Requirements

### Requirement: Route Auth Service Requests
The API gateway SHALL reverse-proxy all incoming HTTP requests matching path prefixes `/api/auth/` and `/api/v1/auth/` (and exact paths `/api/auth`, `/api/v1/auth`) to the upstream Auth Service (`${AUTH_SERVICE_URL}/api/auth/` or `/api/auth`) across all HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS), preserving query parameters, request bodies, cookies, authorization headers, client IP addresses (`X-Forwarded-For`, `X-Real-IP`), and request tracing headers (`X-Request-ID`).

#### Scenario: Forwarding user registration request
- **WHEN** client sends a `POST /api/v1/auth/register` or `POST /api/auth/register` with JSON body
- **THEN** gateway forwards the request to `${AUTH_SERVICE_URL}/api/auth/register` preserving headers and body, and returns the upstream response to the client

#### Scenario: Forwarding refresh token cookie
- **WHEN** client sends a `POST /api/v1/auth/refresh` or `POST /api/auth/refresh` containing a `refresh_token` cookie
- **THEN** gateway passes the cookie to `${AUTH_SERVICE_URL}/api/auth/refresh` and forwards `Set-Cookie` response headers back to the client

#### Scenario: Preserving query parameters on auth routes
- **WHEN** client sends a `GET /api/v1/auth/verify-email?token=xyz123&redirect=app`
- **THEN** gateway proxies the request to `${AUTH_SERVICE_URL}/api/auth/verify-email?token=xyz123&redirect=app` preserving full query string

### Requirement: Route Public JWKS Key Distribution
The API gateway SHALL reverse-proxy requests for `/.well-known/jwks.json` directly to the Auth Service JWKS public keys endpoint at `${AUTH_SERVICE_URL}/.well-known/jwks.json` without requiring authentication, returning RS256 JWKS JSON with appropriate CORS and caching headers.

#### Scenario: Fetching JWKS public keys
- **WHEN** client or downstream service requests `GET /.well-known/jwks.json`
- **THEN** gateway proxies the request to `${AUTH_SERVICE_URL}/.well-known/jwks.json` returning the RS256 JWKS JSON with HTTP 200

#### Scenario: JWKS preflight OPTIONS request
- **WHEN** browser sends `OPTIONS /.well-known/jwks.json` with CORS headers
- **THEN** gateway returns HTTP 204 No Content with CORS allow headers immediately

### Requirement: Route Product Service Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/products/` and `/api/v1/products/` (and exact paths `/api/products`, `/api/v1/products`) to the upstream Product Service (`${PRODUCT_SERVICE_URL}/api/v1/products/` or `/api/v1/products`) while applying CORS, anti-spoofing sanitization, and mutation-only authentication offloading (`/_auth_verify_mutation_only`).

#### Scenario: Fetching product catalog anonymously
- **WHEN** client sends `GET /api/products?page=1&limit=20` or `GET /api/v1/products?page=1&limit=20`
- **THEN** gateway forwards the request to `${PRODUCT_SERVICE_URL}/api/v1/products?page=1&limit=20` without requiring auth token and returns HTTP 200 response

#### Scenario: Creating a product with authorization token
- **WHEN** client sends `POST /api/v1/products` with `Authorization: Bearer <jwt>` and product payload
- **THEN** gateway verifies the token via subrequest, injects verified `X-User-Id` and `X-User-Role` headers, proxies payload to `${PRODUCT_SERVICE_URL}/api/v1/products`, and returns the upstream response

#### Scenario: Mutating product without token rejected
- **WHEN** client sends `DELETE /api/v1/products/101` without an `Authorization` header
- **THEN** gateway rejects the request with HTTP 401 Unauthorized at perimeter without invoking Product Service

### Requirement: Route Order Service Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/orders/` and `/api/v1/orders/` (and exact paths `/api/orders`, `/api/v1/orders`) to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/orders/` or `/api/v1/orders`) while applying CORS, anti-spoofing sanitization, full authentication offloading (`/_auth_verify`), and proxy headers.

#### Scenario: Creating an order with authenticated token
- **WHEN** client sends `POST /api/v1/orders` (or `POST /api/orders`) with `Authorization: Bearer <jwt>` and order payload
- **THEN** gateway validates credentials against the auth verification subrequest, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies the request to `${ORDER_SERVICE_URL}/api/v1/orders`, and returns the upstream response

#### Scenario: Fetching order details with authentication
- **WHEN** client sends `GET /api/v1/orders/123` (or `GET /api/orders/123`) with valid user token
- **THEN** gateway verifies token against Auth Service, injects verified identity claims, forwards request to `${ORDER_SERVICE_URL}/api/v1/orders/123`, and returns order data

#### Scenario: Order request without valid token rejected
- **WHEN** client sends `GET /api/v1/orders` without credentials or with expired token
- **THEN** gateway rejects request with HTTP 401 Unauthorized before forwarding downstream

## ADDED Requirements

### Requirement: Route Health Check Probes
The API gateway SHALL handle `GET /health` requests internally without forwarding to downstream microservices, returning HTTP 200 with JSON payload `{"status":"UP","service":"store_gateway"}` and `default_type application/json`.

#### Scenario: Load balancer health probe
- **WHEN** orchestrator sends `GET /health`
- **THEN** gateway returns HTTP 200 with body `{"status":"UP","service":"store_gateway"}` and skips access logging
