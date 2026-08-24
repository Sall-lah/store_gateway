## ADDED Requirements

### Requirement: Route Auth Service Requests
The API gateway SHALL reverse-proxy all incoming requests with the prefix `/api/auth/` to the upstream Auth Service (`AUTH_SERVICE_URL`) while preserving the full path, query parameters, request headers, body, and client IP addresses.

#### Scenario: Forwarding user registration request
- **WHEN** client sends a `POST /api/auth/register` with JSON body
- **THEN** gateway forwards the request to `AUTH_SERVICE_URL/api/auth/register` preserving headers and body, and returns the upstream response to the client

#### Scenario: Forwarding refresh token cookie
- **WHEN** client sends a `POST /api/auth/refresh` containing a `refresh_token` cookie
- **THEN** gateway passes the cookie to `AUTH_SERVICE_URL/api/auth/refresh` and forwards `Set-Cookie` response headers back to the client

### Requirement: Route Public JWKS Key Distribution
The API gateway SHALL reverse-proxy requests for `/.well-known/jwks.json` directly to the Auth Service JWKS public keys endpoint.

#### Scenario: Fetching JWKS public keys
- **WHEN** client or downstream service requests `GET /.well-known/jwks.json`
- **THEN** gateway proxies the request to `AUTH_SERVICE_URL/.well-known/jwks.json` returning the RS256 JWKS JSON with status 200

### Requirement: Route Product Service Requests
The API gateway SHALL reverse-proxy all incoming requests with the prefix `/api/products/` to the upstream Product Service (`PRODUCT_SERVICE_URL`) while preserving the path, query parameters, authorization headers, and body.

#### Scenario: Fetching product catalog
- **WHEN** client sends `GET /api/products?page=1&limit=20`
- **THEN** gateway forwards the request to `PRODUCT_SERVICE_URL/api/products?page=1&limit=20` and returns the product listing response

#### Scenario: Creating a product with authorization token
- **WHEN** client sends `POST /api/products` with `Authorization: Bearer <jwt>` and product payload
- **THEN** gateway forwards the request with `Authorization` header and payload to `PRODUCT_SERVICE_URL/api/products` and returns the upstream response
