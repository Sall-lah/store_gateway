## Context

`store_gateway` provides a unified documentation hub at `/docs` and proxies Swagger UI, Scalar UI, and OpenAPI schema files for all downstream microservices.

In production environments, exposing API documentation allows external reconnaissance of internal endpoints, data types, and schemas. An environment variable toggle (`ENABLE_DOCS`) allows turning off documentation in production without creating separate Docker images.

## Goals / Non-Goals

**Goals:**
- Provide a clean environment toggle `ENABLE_DOCS` (`true` / `false`).
- Return HTTP 404 for `/docs` and all `/docs/*` routes when `ENABLE_DOCS=false`.
- Ensure `/.well-known/jwks.json` and API endpoints remain accessible at all times.
- Default to `ENABLE_DOCS=true` for local development.

**Non-Goals:**
- Removing documentation files from downstream microservices (downstream services still retain their schemas for developer tooling).

## Decisions

### Decision 1: NGINX Map Directive for Variable Evaluation
- **Choice**: Use an NGINX `map` directive on `${ENABLE_DOCS}` at template substitution time:
  ```nginx
  map "${ENABLE_DOCS}" $docs_disabled {
      "false" 1;
      "0"     1;
      "off"   1;
      default 0;
  }
  ```
- **Rationale**: `map` evaluated inside virtual host template allows clean conditional execution with `if ($docs_disabled) { return 404; }`.

### Decision 2: Update Dockerfile & Environment Filters
- **Choice**: Add `ENABLE_DOCS` to `NGINX_ENVSUBST_FILTER`:
  ```dockerfile
  ENV NGINX_ENVSUBST_FILTER="GATEWAY_PORT|AUTH_SERVICE_URL|PRODUCT_SERVICE_URL|ENABLE_DOCS" \
      ENABLE_DOCS=true
  ```
- **Rationale**: Ensures NGINX startup entrypoint substitutes `${ENABLE_DOCS}` safely while preserving internal NGINX runtime variables.

## Risks / Trade-offs

- **[Risk] Accidental production exposure** → Mitigation: Set default in production env templates to `ENABLE_DOCS=false`.
