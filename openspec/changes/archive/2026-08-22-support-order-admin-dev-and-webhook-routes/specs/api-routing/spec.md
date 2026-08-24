## ADDED Requirements

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
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/dev/orders/` and `/api/dev/orders/` (and exact paths `/api/v1/dev/orders`, `/api/dev/orders`) to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/dev/orders/` or `/api/v1/dev/orders`) while applying CORS, anti-spoofing sanitization, and proxy headers.

#### Scenario: Simulating order payment success
- **WHEN** client sends `POST /api/v1/dev/orders/ORD-123/simulate-success`
- **THEN** gateway forwards request to `${ORDER_SERVICE_URL}/api/v1/dev/orders/ORD-123/simulate-success` preserving headers and body

### Requirement: Route Order Payment Webhook Callbacks
The API gateway SHALL reverse-proxy incoming requests with prefix `/api/v1/orders/webhook/` and `/api/orders/webhook/` to the upstream Order Service (`${ORDER_SERVICE_URL}/api/v1/orders/webhook/` or `/api/v1/orders/webhook/`) without requiring client authentication subrequests, preserving external payload, signature headers, and proxy parameters.

#### Scenario: Receiving payment gateway webhook notification
- **WHEN** external payment provider (e.g. Midtrans) sends unauthenticated `POST /api/v1/orders/webhook/midtrans` with notification payload
- **THEN** gateway proxies request payload and headers directly to `${ORDER_SERVICE_URL}/api/v1/orders/webhook/midtrans` without performing `auth_request` verification subrequest and returns upstream HTTP 200 response
