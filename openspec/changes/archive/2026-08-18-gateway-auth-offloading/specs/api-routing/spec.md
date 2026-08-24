# API Routing Specification Delta

## MODIFIED Requirements

### Requirement: Route Product Service Requests
The API gateway SHALL reverse-proxy all incoming requests with the prefix `/api/products/` to the upstream Product Service (`PRODUCT_SERVICE_URL`) while preserving the path, query parameters, authorization headers, body, and injecting verified `X-User-Id` and `X-User-Role` headers for authenticated operations.

#### Scenario: Fetching product catalog
- **WHEN** client sends `GET /api/products?page=1&limit=20`
- **THEN** gateway forwards the request to `PRODUCT_SERVICE_URL/api/products?page=1&limit=20` anonymously and returns the product listing response

#### Scenario: Creating a product with authorization token
- **WHEN** client sends `POST /api/products` with `Authorization: Bearer <jwt>` and product payload
- **THEN** gateway verifies the token, injects verified `X-User-Id` and `X-User-Role` headers along with the payload to `PRODUCT_SERVICE_URL/api/products`, and returns the upstream response
