## Why

When deploying frontend applications on a separate domain or subdomain (e.g., `yourdomain.com`) alongside the API gateway backend (`api.yourdomain.com`) on a single server using Podman and a host Edge NGINX, the gateway must dynamically accept cross-origin requests from the frontend domain. Currently, the CORS origin mapping in NGINX is statically hardcoded to `localhost` and `127.0.0.1`, which prevents external frontend clients on custom domains from accessing the backend APIs.

## What Changes

- Make the CORS allowed origins pattern configurable at container startup using an environment variable (`CORS_ALLOWED_ORIGIN_REGEX`).
- Update `Dockerfile` to include `CORS_ALLOWED_ORIGIN_REGEX` in `ENV` defaults and `NGINX_ENVSUBST_FILTER`.
- Update `.env.example` to document `CORS_ALLOWED_ORIGIN_REGEX` with examples for local development and custom domains.
- Update `README.md` with standalone Podman container deployment commands and sample Host Edge NGINX reverse-proxy configuration.

## Capabilities

### New Capabilities
<!-- No new capabilities; existing CORS capability is being updated -->

### Modified Capabilities
- `cors-management`: Enhance CORS origin evaluation to be dynamically configured via environment variables instead of hardcoded host regexes, allowing custom frontend domains while preserving secure origin reflection and credential support.

## Impact

- **Affected Files**: `nginx/templates/default.conf.template`, `nginx/nginx.conf`, `Dockerfile`, `.env.example`, `README.md`, and `tests/`.
- **Backward Compatibility**: Fully backward-compatible. The default regex retains support for `localhost` and `127.0.0.1`.
- **External Dependencies**: None. Uses existing NGINX `envsubst` startup template pipeline.
