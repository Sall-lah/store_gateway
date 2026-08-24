# Tasks: Add Admin Product Routing

## 1. NGINX Configuration Updates

- [x] 1.1 Add `/api/admin/products/`, `/api/admin/products`, `/api/v1/admin/products/`, and `/api/v1/admin/products` location blocks to `nginx/templates/default.conf.template`
- [x] 1.2 Include `cors.conf`, `anti-spoofing.conf`, `proxy-params.conf`, and full auth offloading `auth-offload.conf` targeting `${PRODUCT_SERVICE_URL}/api/v1/admin/products/`

## 2. Automated Test Suite Updates

- [x] 2.1 Add admin product template regex and substitution assertions in `tests/gateway-spec.test.mjs`
- [x] 2.2 Add admin product endpoint contract and mock simulation tests in `tests/gateway-spec.test.mjs`
- [x] 2.3 Add full perimeter authentication verification test cases for admin product routes in `tests/auth-flow.test.mjs`

## 3. Documentation & Verification

- [x] 3.1 Update `README.md` route mapping table, architecture diagrams, and curl recipes to include admin product endpoints
- [x] 3.2 Execute automated test suite (`npm test`) to ensure all test assertions pass
