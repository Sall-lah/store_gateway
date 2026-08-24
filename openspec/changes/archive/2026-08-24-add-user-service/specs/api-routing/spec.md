## ADDED Requirements

### Requirement: Route User Service Requests
The API gateway SHALL reverse-proxy all incoming HTTP requests matching path prefixes `/api/users/` and `/api/v1/users/` (and exact paths `/api/users`, `/api/v1/users`) to the upstream User Service (`${USER_SERVICE_URL}/api/users/` or `/api/users`) across all supported HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS), preserving query parameters, request bodies, client IP addresses (`X-Forwarded-For`, `X-Real-IP`), and request tracing headers (`X-Request-ID`), while applying CORS preflight management, anti-spoofing header sanitization, and full perimeter authentication offloading (`/_auth_verify`).

#### Scenario: Fetching user profile with authentication
- **WHEN** client sends `GET /api/v1/users/profile` (or `GET /api/users/profile`) with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies the token against Auth Service, injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` headers, proxies request to `${USER_SERVICE_URL}/api/users/profile`, and returns the user profile with HTTP 200

#### Scenario: Updating user profile with authentication
- **WHEN** client sends `PUT /api/v1/users/profile` with JSON payload and a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies credentials via subrequest, passes request payload and verified `X-User-*` claims to `${USER_SERVICE_URL}/api/users/profile`, and returns HTTP 200

#### Scenario: Deleting user account with authentication
- **WHEN** client sends `DELETE /api/v1/users/account` with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies token, passes request and verified claims to `${USER_SERVICE_URL}/api/users/account`, and returns HTTP 200 (or HTTP 409 if active orders exist)

#### Scenario: Listing and mutating user notifications
- **WHEN** client sends `GET /api/v1/users/notifications?page=1&limit=20` or `PATCH /api/v1/users/notifications/123/read` with a valid `Authorization: Bearer <jwt>`
- **THEN** gateway verifies credentials, proxies query params and path parameters downstream to User Service with verified `X-User-Id` header, and returns the response

#### Scenario: Updating notification preferences
- **WHEN** client sends `PUT /api/v1/users/notifications/preferences` with JSON body and a valid `Authorization: Bearer <jwt>`
- **THEN** gateway validates identity, forwards body to `${USER_SERVICE_URL}/api/users/notifications/preferences`, and returns updated preferences

#### Scenario: Unauthenticated user request rejected at perimeter
- **WHEN** client sends `GET /api/v1/users/profile` or `PUT /api/v1/users/profile` without credentials or with an invalid token
- **THEN** gateway immediately rejects the request with HTTP 401 Unauthorized before forwarding downstream to User Service
