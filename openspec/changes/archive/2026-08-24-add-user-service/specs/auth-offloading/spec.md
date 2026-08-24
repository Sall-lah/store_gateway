## MODIFIED Requirements

### Requirement: Perimeter Authentication Verification
The API Gateway SHALL verify caller authentication tokens on protected routes (including Product Service mutating routes, Product Service admin routes, Order Service all routes, and User Service all routes) by issuing an internal subrequest to `${AUTH_SERVICE_URL}/api/auth/me` before forwarding the client request downstream. The subrequest SHALL carry the client's `Authorization` header, `Cookie`, `X-Original-URI`, `X-Original-Method`, and `X-Request-ID`. If authentication succeeds (HTTP 200), the gateway SHALL extract user claims and inject them into upstream proxy headers. If authentication fails, the gateway SHALL immediately terminate the request with HTTP 401 Unauthorized.

#### Scenario: Valid bearer token allows request and injects user context
- **WHEN** client sends a request to a protected endpoint with a valid `Authorization: Bearer <token>`
- **THEN** gateway verifies the token with Auth Service, extracts user metadata (`X-User-Id`, `X-User-Role`, `X-User-Email`), injects these headers into the upstream request, and returns the downstream response with HTTP 200/201

#### Scenario: Missing or invalid token rejects at perimeter
- **WHEN** client sends a request to a protected mutating endpoint, admin endpoint, or user service endpoint without an Authorization header or with an invalid/expired token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized without invoking downstream services

#### Scenario: Cookie-based authentication verification
- **WHEN** client sends a request with an `access_token` cookie to a protected route
- **THEN** gateway forwards cookie in the subrequest to `${AUTH_SERVICE_URL}/api/auth/me`, extracts claims, and injects verified `X-User-*` headers downstream

#### Scenario: Mutation-only routes allow public GET access
- **WHEN** client sends an unauthenticated `GET /api/v1/products`
- **THEN** mutation-only auth verification subrequest returns HTTP 200 immediately, allowing anonymous read access

#### Scenario: Admin product routes require authentication for all methods
- **WHEN** client sends an unauthenticated `GET /api/v1/admin/products`
- **THEN** gateway rejects the request with HTTP 401 Unauthorized at perimeter without forwarding to Product Service

#### Scenario: User Service routes require authentication for all methods
- **WHEN** client sends an unauthenticated `GET /api/v1/users/profile` or `GET /api/users/notifications`
- **THEN** gateway rejects the request with HTTP 401 Unauthorized at perimeter without forwarding to User Service
