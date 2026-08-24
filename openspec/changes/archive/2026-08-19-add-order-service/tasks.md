## 1. Environment & Deployment Configuration

- [x] 1.1 Update `.env.example` and `.env` with `ORDER_SERVICE_URL`
- [x] 1.2 Remove `docker-compose.yml` to support standalone container deployments

## 2. Gateway Template & Route Configuration

- [x] 2.1 Standardize unified `v1` and unversioned aliases for Auth, Product, and Order services in `nginx/templates/default.conf.template`
- [x] 2.2 Configure Order Service reverse proxy routing with perimeter auth offloading in `nginx/templates/default.conf.template`
- [x] 2.3 Configure Order Service documentation proxy routes (`/docs/orders/scalar`, `/docs/orders/swagger`, `/docs/orders/openapi.json`, `/docs/orders/openapi.yaml`) in `nginx/templates/default.conf.template`
- [x] 2.4 Update the unified `/docs` landing hub HTML in `nginx/templates/default.conf.template` to include Order Service portals

## 3. Test Suite Verification & Updates

- [x] 3.1 Update `tests/gateway-spec.test.mjs` to validate Order Service routes, v1 versioning aliases, and doc proxies
- [x] 3.2 Update `tests/auth-flow.test.mjs` to test Order Service authentication offloading, token validation, and anti-spoofing
- [x] 3.3 Execute automated test suite to ensure all contract and flow tests pass

## 4. Documentation & Verification

- [x] 4.1 Update `README.md` with Order Service architecture diagrams, route tables, and standalone Docker execution commands
