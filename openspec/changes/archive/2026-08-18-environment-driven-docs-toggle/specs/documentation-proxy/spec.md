# Documentation Proxy Specification Delta

## ADDED Requirements

### Requirement: Environment-Driven Documentation Availability
The API gateway SHALL evaluate the `ENABLE_DOCS` environment configuration at startup. When `ENABLE_DOCS` is disabled (`false` or `0`), all documentation endpoints (`/docs`, `/docs/auth/*`, `/docs/products/*`) SHALL return HTTP 404 Not Found, while public key distribution (`/.well-known/jwks.json`) and API endpoints remain fully functional.

#### Scenario: Documentation enabled in development
- **WHEN** gateway runs with `ENABLE_DOCS=true` and client requests `GET /docs` or `GET /docs/products/scalar`
- **THEN** gateway serves the documentation hub and proxies downstream UI documentation with HTTP 200

#### Scenario: Documentation disabled in production
- **WHEN** gateway runs with `ENABLE_DOCS=false` and client requests `GET /docs`, `GET /docs/auth`, `GET /docs/products/scalar`, or raw spec files
- **THEN** gateway immediately returns HTTP 404 Not Found without forwarding requests downstream
