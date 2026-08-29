## Context

`store_gateway` acts as the single entry point for backend microservices (`auth-service`, `product-service`, `order-service`, `user-service`). In single-server production architectures using Podman and a host Edge NGINX:
- The frontend (e.g., `https://yourdomain.com`) runs in a standalone frontend container.
- The API gateway (`https://api.yourdomain.com`) runs in the `store_gateway` container.
- Host Edge NGINX proxies incoming traffic based on subdomain to the appropriate local container ports.

Currently, `nginx/nginx.conf` contains a static `map` directive for `$cors_origin` that only matches `localhost` and `127.0.0.1`. In order for the frontend at `https://yourdomain.com` to communicate with the API gateway, the gateway needs to support customizable allowed origins via environment variables during container startup.

## Goals / Non-Goals

**Goals:**
- Enable configurable CORS origin matching using a new environment variable `CORS_ALLOWED_ORIGIN_REGEX`.
- Maintain full backward compatibility for local development by defaulting the regex to match `localhost` and `127.0.0.1`.
- Update `Dockerfile` to export `CORS_ALLOWED_ORIGIN_REGEX` in `ENV` and whitelist it in `NGINX_ENVSUBST_FILTER`.
- Update `.env.example` and `README.md` with clear configuration guides, standalone Podman deployment steps, and sample Host Edge NGINX snippets.
- Ensure integration and validation tests cover both allowed custom domains and disallowed untrusted origins.

**Non-Goals:**
- Managing or automating host-level Edge NGINX certificate renewals (Certbot is managed on the host).
- Modifying frontend application source code or build steps.
- Altering core auth offloading or microservice routing logic.

## Decisions

### Decision 1: Move CORS Map to NGINX Startup Template
**Rationale**: In the official NGINX image, environment variables are only substituted into `/etc/nginx/templates/*.template` files using `envsubst`. Moving the `map $http_origin $cors_origin` block into `nginx/templates/default.conf.template` allows `${CORS_ALLOWED_ORIGIN_REGEX}` to be injected dynamically at container start while removing the static definition from `nginx/nginx.conf`.

*Alternatives Considered*:
- *Sed/Awk script in custom entrypoint*: More complex, fragile, and deviates from standard NGINX container conventions.
- *OpenResty / Lua dynamically reading env vars*: Adds unnecessary overhead and memory footprint.

### Decision 2: Update `NGINX_ENVSUBST_FILTER` Whitelist
**Rationale**: `NGINX_ENVSUBST_FILTER` prevents `envsubst` from stripping out internal NGINX runtime variables like `$http_origin`, `$host`, `$req_id`, and `$request_uri`. Adding `CORS_ALLOWED_ORIGIN_REGEX` to this list ensures only specified environment variables are replaced.

### Decision 3: Document Standalone Podman & Host Edge NGINX Workflows
**Rationale**: Single-server deployments without Docker Compose require explicit container network / pod setup and host-level reverse proxying instructions. Adding copy-pasteable Podman commands and Host NGINX configurations directly to `README.md` simplifies operational maintenance.

## Risks / Trade-offs

- **[Risk]**: Invalid regex syntax provided in `CORS_ALLOWED_ORIGIN_REGEX` breaks NGINX configuration test on container startup.
  - **Mitigation**: Define a safe, tested default regex in `Dockerfile` and `.env.example`. Test runner will validate NGINX configuration (`nginx -t`) under various regex inputs.
- **[Risk]**: Wildcard or overly permissive regex allowing unintended origins to make credentialed requests.
  - **Mitigation**: Document exact domain pattern matching rules in `.env.example` and `README.md`.
