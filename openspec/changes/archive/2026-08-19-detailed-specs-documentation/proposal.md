## Why

As the microservice ecosystem grows (Auth, Product, and Order services), the API Gateway specifications and repository documentation need comprehensive, granular detail to serve as an unambiguous contract for downstream service developers, frontend teams, and platform operators. Existing specifications outline high-level requirements but lack exhaustive technical specifics on path rewrite mechanics, subrequest header contracts, error status code handling, CORS preflight headers, anti-spoofing sanitization rules, and environment-driven documentation proxy behavior.

## What Changes

- **Comprehensive OpenSpec Requirement Detailing**:
  - Refine and detail `api-routing` specification with explicit HTTP verb mappings, query parameter preservation, path rewrite behaviors (e.g., stripping or preserving `/api/v1/`), and upstream error pass-through.
  - Refine and detail `auth-offloading` specification with exact internal subrequest semantics (`/_auth_verify` vs `/_auth_verify_mutation_only`), claim extraction headers (`X-User-Id`, `X-User-Role`, `X-User-Email`), token forwarding (Bearer JWT and cookies), and 401 Unauthorized rejection criteria.
  - Refine and detail `cors-management` specification with explicit preflight response headers (`Access-Control-Max-Age: 86400`, allowed headers list), credentials reflection, and upstream header suppression (`proxy_hide_header`).
  - Refine and detail `documentation-proxy` specification with complete route matrices for Scalar UI, Swagger UI, raw OpenAPI specifications (JSON and YAML), and `ENABLE_DOCS` toggle behaviors.
  - Refine and detail `security-headers` specification covering `X-User-*` client header sanitization, unique `X-Request-ID` generation/propagation, and defense-in-depth security headers (`nosniff`, `SAMEORIGIN`, XSS protection).
- **Detailed Project Documentation (`README.md`)**:
  - Update `README.md` with complete architectural sequence diagrams, comprehensive environment variable reference tables, detailed route & auth policy matrices, and precise troubleshooting & verification curl recipes.

## Capabilities

### New Capabilities
<!-- No new capability domains; this change comprehensively details existing specifications. -->

### Modified Capabilities
- `api-routing`: Detail exact HTTP methods, path transformations, version aliases, and upstream proxy parameters for Auth, Product, and Order endpoints.
- `auth-offloading`: Detail internal subrequest contracts (`/_auth_verify`, `/_auth_verify_mutation_only`), claim extraction headers, and unauthorized perimeter handling.
- `cors-management`: Detail centralized OPTIONS 204 response contracts, header whitelists, caching durations, and upstream duplicate suppression.
- `documentation-proxy`: Detail Scalar and Swagger documentation proxy paths, OpenAPI JSON/YAML endpoints, and `ENABLE_DOCS` conditional response handling.
- `security-headers`: Detail anti-spoofing header stripping list, request trace ID generation, and defense-in-depth header specifications.

## Impact

- **OpenSpec Specifications**: Delta specifications under `openspec/changes/detailed-specs-documentation/specs/` updating `api-routing`, `auth-offloading`, `cors-management`, `documentation-proxy`, and `security-headers`.
- **Repository Documentation**: `README.md` updated with comprehensive spec tables, architecture flows, environment matrix, and testing guide.
- **Test Suite Alignment**: Tests in `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs` validated against detailed requirements.
