## 1. NGINX Configuration & Templates

- [x] 1.1 Move the `$cors_origin` map from `nginx/nginx.conf` into `nginx/templates/default.conf.template` to support `${CORS_ALLOWED_ORIGIN_REGEX}` variable substitution
- [x] 1.2 Update `Dockerfile` to declare `CORS_ALLOWED_ORIGIN_REGEX` with safe localhost/127.0.0.1 default and append it to `NGINX_ENVSUBST_FILTER`
- [x] 1.3 Update `.env.example` with `CORS_ALLOWED_ORIGIN_REGEX` documentation and example values for local development and custom domains

## 2. Testing & Verification

- [x] 2.1 Add automated test cases for dynamic CORS origin matching with custom frontend domains, localhost variants, and disallowed origins
- [x] 2.2 Run test suite and NGINX configuration validation to ensure no regressions in existing routing and CORS behaviors

## 3. Documentation

- [x] 3.1 Update `README.md` with standalone Podman deployment commands (using both user networks and Podman pods) and sample Host Edge NGINX reverse-proxy configuration
