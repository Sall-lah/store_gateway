# Auth Offloading Specification

## ADDED Requirements

### Requirement: Perimeter Authentication Verification
The API Gateway SHALL verify authentication tokens on protected routes by performing an internal subrequest to the Auth Service verification endpoint before allowing downstream forwarding.

#### Scenario: Valid bearer token allows request and injects user context
- **WHEN** client sends a request to a protected endpoint with a valid `Authorization: Bearer <token>`
- **THEN** gateway verifies the token with Auth Service, extracts user metadata (`X-User-Id`, `X-User-Role`, `X-User-Email`), injects these headers into the upstream request, and returns the downstream response with HTTP 200/201

#### Scenario: Missing or invalid token rejects at perimeter
- **WHEN** client sends a request to a protected mutating endpoint without an Authorization header or with an invalid/expired token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized without invoking downstream services

### Requirement: Anti-Spoofing and Identity Injection
The API Gateway SHALL strip all client-supplied `X-User-*` headers and ONLY populate downstream `X-User-*` headers with values verified by the gateway's authentication subrequest.

#### Scenario: Stripping client-forged role headers
- **WHEN** external client sends `X-User-Role: admin` on an unauthenticated or non-admin request
- **THEN** gateway sanitizes the header, overrides or clears it based on authentic token claims, and prevents privilege escalation
