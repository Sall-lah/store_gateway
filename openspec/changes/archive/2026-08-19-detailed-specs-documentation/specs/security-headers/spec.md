## MODIFIED Requirements

### Requirement: Anti-Spoofing Header Stripping
The API gateway SHALL strip all incoming client headers prefixed with `X-User-` (including `X-User-Id`, `X-User-Email`, `X-User-Role`, `X-User-Permissions`) before forwarding requests to any upstream microservice. Only gateway authentication offloading subrequests may set downstream `X-User-*` headers.

#### Scenario: Malicious client attempting header injection
- **WHEN** client sends a request containing `X-User-Id: spoofed-admin-id` and `X-User-Role: admin`
- **THEN** gateway strips these headers from the proxy request payload, preventing downstream trust of spoofed headers

#### Scenario: Stripping custom user permission claims
- **WHEN** client passes `X-User-Permissions: all`
- **THEN** gateway clears the header before the request reaches the upstream service

### Requirement: Standard Defense-in-Depth Headers and Request Tracing
The API gateway SHALL generate a unique request ID (via `$req_id` or `$request_id`) when omitted by client, propagate `X-Request-ID` on all proxied requests and responses, and attach standard defense-in-depth security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`) to all HTTP responses.

#### Scenario: Request tracking with X-Request-ID
- **WHEN** a request arrives without an `X-Request-ID` header
- **THEN** gateway generates a unique request ID, forwards it downstream in `X-Request-ID`, and includes it in the gateway access log and response headers

#### Scenario: Preserving existing client X-Request-ID
- **WHEN** client sends a request with an existing `X-Request-ID: trace-abc-123`
- **THEN** gateway adopts and propagates `trace-abc-123` across subrequests, upstream proxies, and response headers
