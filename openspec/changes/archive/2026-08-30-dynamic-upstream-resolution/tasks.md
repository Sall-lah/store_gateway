## 1. Docker & Environment Configuration

- [x] 1.1 Expose `DNS_RESOLVER=127.0.0.11` in `Dockerfile` and append `DNS_RESOLVER` to `NGINX_ENVSUBST_FILTER`
- [x] 1.2 Document `DNS_RESOLVER` configuration and default in `.env.example`

## 2. NGINX Template Refactoring

- [x] 2.1 Add `resolver ${DNS_RESOLVER} valid=5s ipv6=off;` and `resolver_timeout 3s;` directives to `nginx/templates/default.conf.template`
- [x] 2.2 Declare backend upstream variables (`$auth_backend`, `$product_backend`, `$order_backend`, `$user_backend`) inside `server` block
- [x] 2.3 Update subrequest auth verification locations (`/_auth_verify`, `/_auth_verify_mutation_only`) to use `$auth_backend`
- [x] 2.4 Update Auth Service routes (`/api/auth/`, `/api/v1/auth/`, and `/.well-known/jwks.json`) to use variable-based dynamic proxying
- [x] 2.5 Update Product Service routes (`/api/products/`, `/api/v1/products/`, `/api/admin/products/`, `/api/v1/admin/products/`) with variable proxying and path rewrites
- [x] 2.6 Update Order Service routes (`/api/orders/`, `/api/v1/orders/`, webhooks, dev, and admin routes) with variable proxying and path rewrites
- [x] 2.7 Update User Service routes (`/api/users/`, `/api/v1/users/`) with variable proxying and path rewrites
- [x] 2.8 Update Documentation proxy locations to use upstream variables and path rewrites

## 3. Contract Tests & Verification

- [x] 3.1 Update `tests/gateway-spec.test.mjs` assertions to validate `resolver` directive, `DNS_RESOLVER` envsubst filter, and variable proxying
- [x] 3.2 Add test cases asserting correct rendered upstream paths and query parameter preservation across all services
- [x] 3.3 Execute `npm test` to verify that both `auth-flow.test.mjs` and `gateway-spec.test.mjs` suites pass completely
