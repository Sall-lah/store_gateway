## ADDED Requirements

### Requirement: Centralized CORS Preflight Handling
The API gateway SHALL intercept incoming HTTP `OPTIONS` requests across all API routes and respond immediately with HTTP `204 No Content`, supplying appropriate CORS headers without contacting upstream services.

#### Scenario: Browser CORS preflight check
- **WHEN** client sends an `OPTIONS` request to `/api/products` or `/api/auth/login` with `Origin` and `Access-Control-Request-Method`
- **THEN** gateway returns HTTP `204 No Content` with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials: true`, and `Access-Control-Max-Age: 86400`

### Requirement: CORS Response Headers on Proxied Requests
The API gateway SHALL ensure that responses to standard requests (GET, POST, PUT, PATCH, DELETE) include matching `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` headers based on allowed origins configuration, and suppress duplicate CORS headers from upstreams.

#### Scenario: Authenticated cross-origin request
- **WHEN** frontend client from an allowed origin sends `GET /api/products`
- **THEN** gateway proxies the request, attaches `Access-Control-Allow-Origin` matching the request origin and `Access-Control-Allow-Credentials: true`, and returns the response
