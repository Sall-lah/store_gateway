## 1. NGINX Configuration Cleanup

- [x] 1.1 Remove `sub_filter` and `proxy_set_header Accept-Encoding ""` from `location /docs/auth/` in `nginx/templates/default.conf.template`
- [x] 1.2 Remove `sub_filter` and `proxy_set_header Accept-Encoding ""` from `location /docs/products/scalar/` and `location /docs/products/swagger/`
- [x] 1.3 Remove `sub_filter` and `proxy_set_header Accept-Encoding ""` from `location /docs/orders/swagger`
- [x] 1.4 Remove `sub_filter` and `proxy_set_header Accept-Encoding ""` from `location = /docs/users` and `location /docs/users/swagger`
- [x] 1.5 Remove root fallback routes `location = /docs/openapi.yaml` and `location = /openapi.json`

## 2. Test Suite & Main Spec Update

- [x] 2.1 Update `tests/gateway-spec.test.mjs` to remove `sub_filter` and fallback route assertions and verify clean pass-through routing
- [x] 2.2 Run automated test suite (`npm test`) to ensure all tests pass
- [x] 2.3 Sync delta spec changes to `openspec/specs/documentation-proxy/spec.md`

## 3. Container Rebuild & Deployment

- [x] 3.1 Rebuild the `store_gateway` image via Podman
- [x] 3.2 Restart `store_gateway` container on `store-network` with `.env`
- [x] 3.3 Verify live documentation endpoints via HTTP requests
