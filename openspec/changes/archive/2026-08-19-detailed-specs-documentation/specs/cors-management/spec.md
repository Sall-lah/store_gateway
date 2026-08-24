## MODIFIED Requirements

### Requirement: Centralized CORS Preflight Handling
The API gateway SHALL intercept incoming HTTP `OPTIONS` requests across all API routes and respond immediately with HTTP `204 No Content`, supplying appropriate CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Request-ID`, `Access-Control-Allow-Credentials: true`, and `Access-Control-Max-Age: 86400`) without contacting upstream microservices.

#### Scenario: Browser CORS preflight check
- **WHEN** client sends an `OPTIONS` request to `/api/products` or `/api/auth/login` with `Origin` and `Access-Control-Request-Method`
- **THEN** gateway returns HTTP `204 No Content` with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials: true`, and `Access-Control-Max-Age: 86400`

#### Scenario: Preflight on order routes
- **WHEN** frontend client sends `OPTIONS /api/v1/orders` from an allowed origin
- **THEN** gateway responds with HTTP 204 No Content without triggering authentication verification subrequests

### Requirement: CORS Response Headers on Proxied Requests
The API gateway SHALL ensure that responses to standard requests (GET, POST, PUT, PATCH, DELETE) include matching `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true` headers based on allowed origins configuration, and suppress duplicate CORS headers from upstreams via `proxy_hide_header`.

#### Scenario: Authenticated cross-origin request
- **WHEN** frontend client from an allowed origin sends `GET /api/products`
- **THEN** gateway proxies the request, attaches `Access-Control-Allow-Origin` matching the request origin and `Access-Control-Allow-Credentials: true`, and returns the response

#### Scenario: Suppressing duplicate upstream CORS headers
- **WHEN** upstream microservice also attaches `Access-Control-Allow-Origin` in its response
- **THEN** gateway strips the upstream CORS header using `proxy_hide_header` ensuring clients receive only a single consolidated CORS header
