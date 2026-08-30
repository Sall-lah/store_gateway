# API Routing Specification

## Purpose
Defines reverse proxy routing conventions for Auth Service endpoints, public RS256 JWKS key distribution, Product Service endpoints, Order Service endpoints, User Service endpoints, and internal health check probes with unified `v1` versioning and backward-compatible aliases.

## Requirements

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

### Requirement: Route Admin Product Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/admin/products/` and `/api/admin/products/` (and exact paths `/api/v1/admin/products`, `/api/admin/products`) to the upstream Product Service (`${PRODUCT_SERVICE_URL}/api/v1/admin/products/` or `/api/admin/products`) while applying CORS, anti-spoofing sanitization, full authentication offloading (`/_auth_verify`), and proxy headers across all HTTP methods.

#### Scenario: Admin querying product catalog
- **WHEN** client sends `GET /api/v1/admin/products` with valid admin authentication credentials
- **THEN** gateway verifies the token with Auth Service, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies request to `${PRODUCT_SERVICE_URL}/api/v1/admin/products`, and returns HTTP 200 response

#### Scenario: Admin creating a new product
- **WHEN** client sends `POST /api/v1/admin/products` with JSON payload and valid admin credentials
- **THEN** gateway verifies token, passes request body and verified headers to `${PRODUCT_SERVICE_URL}/api/v1/admin/products`, and returns upstream response

#### Scenario: Unauthenticated admin product request rejected at perimeter
- **WHEN** client sends `GET /api/v1/admin/products` or `POST /api/v1/admin/products` without credentials or with an invalid token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized before forwarding downstream

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

### Requirement: Route Admin Order Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/admin/orders/` and `/api/admin/orders/` (and exact paths `/api/v1/admin/orders`, `/api/admin/orders`) to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/admin/orders/` or `/api/v1/admin/orders`) while applying CORS, anti-spoofing sanitization, full authentication offloading (`/_auth_verify`), and proxy headers.

#### Scenario: Admin querying orders
- **WHEN** client sends `GET /api/v1/admin/orders` with valid admin authentication credentials
- **THEN** gateway verifies the token with Auth Service, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies request to `${ORDER_SERVICE_URL}/api/v1/admin/orders`, and returns HTTP 200 response

#### Scenario: Admin updating order status
- **WHEN** client sends `PUT /api/v1/admin/orders/123/status` with JSON body and valid admin credentials
- **THEN** gateway verifies token, passes request body and verified headers to `${ORDER_SERVICE_URL}/api/v1/admin/orders/123/status`, and returns upstream response

#### Scenario: Unauthenticated admin order request rejected
- **WHEN** client sends `GET /api/v1/admin/orders` without credentials or with an invalid token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized before forwarding downstream

### Requirement: Route Dev Order Simulation Requests
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/dev/orders/` and `/api/dev/orders/` (and exact paths `/api/v1/dev/orders`, `/api/dev/orders`) to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/dev/orders/` or `/api/dev/orders`) while applying CORS, anti-spoofing sanitization, and proxy headers.

#### Scenario: Simulating order payment success
- **WHEN** client sends `POST /api/v1/dev/orders/ORD-123/simulate-success`
- **THEN** gateway forwards request to `${ORDER_SERVICE_URL}/api/v1/dev/orders/ORD-123/simulate-success` preserving headers and body

### Requirement: Route Order Payment Webhook Callbacks
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/orders/webhook/` and `/api/orders/webhook/` to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/orders/webhook/` or `/api/orders/webhook/`) without requiring client authentication subrequests, preserving external payload, signature headers, and proxy parameters.

#### Scenario: Receiving payment gateway webhook notification
- **WHEN** external payment provider (e.g. Midtrans) sends unauthenticated `POST /api/v1/orders/webhook/midtrans` with notification payload
- **THEN** gateway proxies request payload and headers directly to `${ORDER_SERVICE_URL}/api/v1/orders/webhook/midtrans` without performing `auth_request` verification subrequest and returns upstream HTTP 200 response

### Requirement: Route User Service Requests
The API gateway SHALL reverse-proxy all incoming HTTP requests matching path prefixes `/api/users/` and `/api/v1/users/` (and exact paths `/api/users`, `/api/v1/users`) to the upstream User Service (`${USER_SERVICE_URL}/api/users/` or `/api/users`) across all supported HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS), preserving query parameters, request bodies, client IP addresses (`X-Forwarded-For`, `X-Real-IP`), and request tracing headers (`X-Request-ID`), while applying CORS preflight management, anti-spoofing header sanitization, and full perimeter authentication offloading (`/_auth_verify`).

#### Scenario: Fetching user profile with authentication
- **WHEN** client sends `GET /api/v1/users/profile` (or `GET /api/users/profile`) with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies the token against Auth Service, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies request to `${USER_SERVICE_URL}/api/users/profile`, and returns the user profile with HTTP 200

#### Scenario: Updating user profile with authentication
- **WHEN** client sends `PUT /api/v1/users/profile` with JSON payload and a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies credentials via subrequest, passes request payload and verified `X-User-*` claims to `${USER_SERVICE_URL}/api/users/profile`, and returns HTTP 200

#### Scenario: Deleting user account with authentication
- **WHEN** client sends `DELETE /api/v1/users/account` with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies token, passes request and verified claims to `${USER_SERVICE_URL}/api/users/account`, and returns HTTP 200 (or HTTP 409 if active orders exist)

#### Scenario: Listing and mutating user notifications
- **WHEN** client sends `GET /api/v1/users/notifications?page=1&limit=20` or `PATCH /api/v1/users/notifications/123/read` with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies credentials, proxies query params and path parameters downstream to User Service with verified `X-User-Id` header, and returns the response

#### Scenario: Updating notification preferences
- **WHEN** client sends `PUT /api/v1/users/notifications/preferences` with JSON body and a valid `Authorization: Bearer <jwt>`
- **THEN** gateway validates identity, forwards body to `${USER_SERVICE_URL}/api/users/notifications/preferences`, and returns updated preferences

#### Scenario: Unauthenticated user request rejected at perimeter
- **WHEN** client sends `GET /api/v1/users/profile` or `PUT /api/v1/users/profile` without credentials or with an invalid token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized before forwarding downstream to User Service

### Requirement: Route Health Check Probes
The API gateway SHALL handle `GET /health` requests internally without forwarding to downstream microservices, returning HTTP 200 with JSON payload `{"status":"UP","service":"store_gateway"}` and `default_type application/json`.

#### Scenario: Load balancer health probe
- **WHEN** orchestrator sends `GET /health`
- **THEN** gateway returns HTTP 200 with body `{"status":"UP","service":"store_gateway"}` and skips access logging

### Requirement: Dynamic Upstream DNS Resolution
The API gateway SHALL dynamically resolve upstream microservice hostnames (`AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`, `USER_SERVICE_URL`) at request runtime using an internal NGINX DNS resolver rather than permanently caching IP addresses at startup. The resolver SHALL enforce a short cache validity period (`valid=5s ipv6=off;`) with a default address of `127.0.0.11` (configurable via `DNS_RESOLVER`), ensuring that requests automatically adapt to new container IP addresses across restarts without restarting the gateway.

#### Scenario: Upstream container restart with new IP
- **WHEN** an upstream microservice container (e.g. `product-service`) restarts and acquires a new IP address on the Docker bridge network
- **THEN** the API gateway resolves the new container IP address within the configured resolver TTL and routes subsequent requests without returning persistent 502 Bad Gateway errors

#### Scenario: Gateway startup resilience before upstreams are ready
- **WHEN** the API gateway boots while one or more upstream microservices are temporarily initializing or unreachable on DNS
- **THEN** NGINX starts up successfully without failing configuration parsing or crashing on boot, and dynamically connects as soon as the upstream services register in DNS

#### Scenario: Custom DNS resolver configuration
- **WHEN** the gateway container is deployed with a custom `DNS_RESOLVER` environment variable (e.g. Kubernetes CoreDNS `10.96.0.10` or host resolver)
- **THEN** NGINX envsubst substitutes the configured resolver address into the virtual host configuration
