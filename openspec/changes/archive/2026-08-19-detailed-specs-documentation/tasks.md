## 1. OpenSpec Specification Detailing

- [x] 1.1 Refine delta specs for `api-routing` covering explicit HTTP methods, query preservation, and health checks
- [x] 1.2 Refine delta specs for `auth-offloading` detailing subrequest contracts, claim headers, and perimeter rejection
- [x] 1.3 Refine delta specs for `cors-management` detailing preflight caching, allowed headers, and duplicate suppression
- [x] 1.4 Refine delta specs for `documentation-proxy` detailing Scalar/Swagger endpoints, raw schema routing, and `ENABLE_DOCS` toggle
- [x] 1.5 Refine delta specs for `security-headers` detailing header sanitization, trace ID generation, and defense headers

## 2. Project Documentation Enrichment

- [x] 2.1 Update `README.md` with sequence diagrams for perimeter auth offloading and CORS preflight flows
- [x] 2.2 Expand route and documentation mapping table with complete HTTP methods, auth policies, and upstream targets
- [x] 2.3 Document complete environment variable dictionary (`GATEWAY_PORT`, `ENABLE_DOCS`, `AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`)
- [x] 2.4 Add comprehensive testing and verification curl commands for all routes and edge cases

## 3. Verification & Validation

- [x] 3.1 Run automated test suite (`npm test`) to verify test suite compatibility with detailed specifications
- [x] 3.2 Verify OpenSpec change status and readiness for implementation sync
