## ADDED Requirements

### Requirement: Anti-Spoofing Header Stripping
The API gateway SHALL strip all incoming client headers prefixed with `X-User-` (including `X-User-Id`, `X-User-Email`, `X-User-Role`, `X-User-Permissions`) before forwarding requests to any upstream microservice.

#### Scenario: Malicious client attempting header injection
- **WHEN** client sends a request containing `X-User-Id: spoofed-admin-id` and `X-User-Role: admin`
- **THEN** gateway strips these headers from the proxy request payload, preventing downstream trust of spoofed headers

### Requirement: Standard Defense-in-Depth Headers and Request Tracing
The API gateway SHALL generate or propagate an `X-Request-ID` header on all proxied requests and attach standard defense-in-depth security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`).

#### Scenario: Request tracking with X-Request-ID
- **WHEN** a request arrives without an `X-Request-ID` header
- **THEN** gateway generates a unique request ID, forwards it downstream in `X-Request-ID`, and includes it in the gateway access log and response headers
