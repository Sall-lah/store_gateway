## MODIFIED Requirements

### Requirement: Perimeter Authentication Verification
The API Gateway SHALL verify caller authentication tokens on protected routes (including Product Service mutating routes and Order Service all routes) by issuing an internal subrequest to `${AUTH_SERVICE_URL}/api/auth/me` before forwarding the client request downstream. The subrequest SHALL carry the client's `Authorization` header, `Cookie`, `X-Original-URI`, `X-Original-Method`, and `X-Request-ID`. If authentication succeeds (HTTP 200), the gateway SHALL extract user claims and inject them into upstream proxy headers. If authentication fails, the gateway SHALL immediately terminate the request with HTTP 401 Unauthorized.

#### Scenario: Valid bearer token allows request and injects user context
- **WHEN** client sends a request to a protected endpoint with a valid `Authorization: Bearer <token>`
- **THEN** gateway verifies the token with Auth Service, extracts user metadata (`X-User-Id`, `X-User-Role`, `X-User-Email`), injects these headers into the upstream request, and returns the downstream response with HTTP 200/201

#### Scenario: Missing or invalid token rejects at perimeter
- **WHEN** client sends a request to a protected mutating endpoint without an Authorization header or with an invalid/expired token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized without invoking downstream services

#### Scenario: Cookie-based authentication verification
- **WHEN** client sends a request with an `access_token` cookie to a protected route
- **THEN** gateway forwards cookie in the subrequest to `${AUTH_SERVICE_URL}/api/auth/me`, extracts claims, and injects verified `X-User-*` headers downstream

#### Scenario: Mutation-only routes allow public GET access
- **WHEN** client sends an unauthenticated `GET /api/v1/products`
- **THEN** mutation-only auth verification subrequest returns HTTP 200 immediately, allowing anonymous read access

### Requirement: Anti-Spoofing and Identity Injection
The API Gateway SHALL strip all client-supplied `X-User-*` headers (including `X-User-Id`, `X-User-Role`, `X-User-Email`, `X-User-Permissions`) before forwarding requests, and ONLY populate downstream `X-User-*` headers using values verified by the gateway's authentication subrequest across all proxied service endpoints.

#### Scenario: Stripping client-forged role headers
- **WHEN** external client sends `X-User-Role: admin` on an unauthenticated or non-admin request
- **THEN** gateway sanitizes the header, overrides or clears it based on authentic token claims, and prevents privilege escalation

#### Scenario: Verified claim injection on authenticated request
- **WHEN** authenticated user with ID `usr-999` and role `customer` makes a protected request
- **THEN** gateway strips any client `X-User-*` headers and injects verified `X-User-Id: usr-999` and `X-User-Role: customer`
