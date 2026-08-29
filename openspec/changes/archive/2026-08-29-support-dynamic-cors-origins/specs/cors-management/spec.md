## ADDED Requirements

### Requirement: Dynamic CORS Origin Evaluation via Environment Variable
The API gateway SHALL evaluate incoming HTTP request origins against a configurable regular expression defined by the `CORS_ALLOWED_ORIGIN_REGEX` environment variable at container startup. When the client `Origin` matches the configured regular expression, the gateway SHALL dynamically echo the matching origin in the `Access-Control-Allow-Origin` header and set `Access-Control-Allow-Credentials: true`. When the client `Origin` does not match, the gateway SHALL return an empty origin value, preventing unauthorized cross-origin requests.

#### Scenario: Allowed custom frontend domain request
- **WHEN** client sends a request with `Origin: https://yourdomain.com` and `CORS_ALLOWED_ORIGIN_REGEX` matches `yourdomain.com`
- **THEN** gateway responds with `Access-Control-Allow-Origin: https://yourdomain.com` and `Access-Control-Allow-Credentials: true`

#### Scenario: Allowed localhost request with custom port
- **WHEN** client sends a request with `Origin: http://localhost:3000` during local development
- **THEN** gateway responds with `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`

#### Scenario: Disallowed origin request
- **WHEN** client sends a request with `Origin: https://malicious-site.com` not matching `CORS_ALLOWED_ORIGIN_REGEX`
- **THEN** gateway does not return `Access-Control-Allow-Origin` for the untrusted origin

## MODIFIED Requirements

### Requirement: CORS Response Headers on Proxied Requests
The API gateway SHALL ensure that responses to standard requests (GET, POST, PUT, PATCH, DELETE) include dynamic `Access-Control-Allow-Origin` matching the validated request origin and `Access-Control-Allow-Credentials: true` headers based on the environment-driven allowed origins regex, and suppress duplicate CORS headers from upstreams via `proxy_hide_header`.

#### Scenario: Authenticated cross-origin request from configured frontend domain
- **WHEN** frontend client from an allowed origin (e.g., `https://yourdomain.com`) sends `GET /api/products`
- **THEN** gateway proxies the request, attaches `Access-Control-Allow-Origin: https://yourdomain.com` and `Access-Control-Allow-Credentials: true`, and returns the response

#### Scenario: Suppressing duplicate upstream CORS headers
- **WHEN** upstream microservice also attaches `Access-Control-Allow-Origin` in its response
- **THEN** gateway strips the upstream CORS header using `proxy_hide_header` ensuring clients receive only a single consolidated CORS header
