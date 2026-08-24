## ADDED Requirements

### Requirement: Payment Webhook Authentication Exemption
The API Gateway SHALL bypass the `auth_request` verification subrequest for payment webhook endpoints under `/api/v1/orders/webhook/` and `/api/orders/webhook/`, allowing unauthenticated external provider notification requests to reach downstream services while continuing to strip untrusted incoming `X-User-*` identity headers via anti-spoofing sanitization.

#### Scenario: External webhook bypasses authentication subrequest
- **WHEN** third-party payment gateway sends a webhook HTTP POST to `/api/v1/orders/webhook/midtrans` without Authorization headers or user session cookies
- **THEN** gateway allows the request through without subrequest authentication, clears any incoming `X-User-*` headers, and proxies the payload downstream

#### Scenario: Anti-spoofing sanitization preserved on webhook routes
- **WHEN** client sends a request to `/api/v1/orders/webhook/midtrans` with header `X-User-Role: admin`
- **THEN** gateway sanitizes and clears the `X-User-Role` header before forwarding to Order Service
