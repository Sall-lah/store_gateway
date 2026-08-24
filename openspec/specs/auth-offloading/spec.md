# Auth Offloading Specification

## Purpose
Defines gateway authentication verification subrequests, anti-spoofing header sanitization, and verified user claim injection for downstream microservices (Product Service, Order Service, User Service).

## Requirements

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

### Requirement: Anti-Spoofing and Identity Injection
The API Gateway SHALL strip all client-supplied `X-User-*` headers (including `X-User-Id`, `X-User-Role`, `X-User-Email`, `X-User-Permissions`) before forwarding requests, and ONLY populate downstream `X-User-*` headers using values verified by the gateway's authentication subrequest across all proxied service endpoints.

#### Scenario: Stripping client-forged role headers
- **WHEN** external client sends `X-User-Role: admin` on an unauthenticated or non-admin request
- **THEN** gateway sanitizes the header, overrides or clears it based on authentic token claims, and prevents privilege escalation

#### Scenario: Verified claim injection on authenticated request
- **WHEN** authenticated user with ID `usr-999` and role `customer` makes a protected request
- **THEN** gateway strips any client `X-User-*` headers and injects verified `X-User-Id: usr-999` and `X-User-Role: customer`

### Requirement: Payment Webhook Authentication Exemption
The API Gateway SHALL bypass the `auth_request` verification subrequest for payment webhook endpoints under `/api/v1/orders/webhook/` and `/api/orders/webhook/`, allowing unauthenticated external provider notification requests to reach downstream services while continuing to strip untrusted incoming `X-User-*` identity headers via anti-spoofing sanitization.

#### Scenario: External webhook bypasses authentication subrequest
- **WHEN** third-party payment gateway sends a webhook HTTP POST to `/api/v1/orders/webhook/midtrans` without Authorization headers or user session cookies
- **THEN** gateway allows the request through without subrequest authentication, clears any incoming `X-User-*` headers, and proxies the payload downstream

#### Scenario: Anti-spoofing sanitization preserved on webhook routes
- **WHEN** client sends a request to `/api/v1/orders/webhook/midtrans` with header `X-User-Role: admin`
- **THEN** gateway sanitizes and clears the `X-User-Role` header before forwarding to Order Service
