## Context

The API gateway currently templates upstream URLs (`${AUTH_SERVICE_URL}`, `${PRODUCT_SERVICE_URL}`, etc.) directly into `proxy_pass` directives at container startup. In NGINX, a static hostname in `proxy_pass` is resolved exactly once during configuration loading and cached in memory permanently.

In containerized environments (Docker Compose, Docker Swarm), restarting a backend container causes Docker to allocate a new IP address on the internal bridge network and update its embedded DNS server (`127.0.0.11`). Because NGINX continues sending traffic to the previous IP address, all proxied requests result in `502 Bad Gateway` until the gateway itself is restarted.

Additionally, if the gateway starts before backend services have registered in DNS, NGINX fails its initial configuration check with `host not found in upstream` and terminates.

## Goals / Non-Goals

**Goals:**
- Enable NGINX to re-resolve upstream service hostnames dynamically with a short cache TTL (`valid=5s`).
- Ensure requests automatically recover within seconds after an upstream container restarts, without requiring a gateway reload.
- Allow the gateway to start cleanly even if upstream microservices are temporarily initializing or unreachable.
- Preserve full backward compatibility for all routing rules, unversioned aliases, subrequest auth offloading, and CORS behavior.
- Support custom resolver IPs (e.g. Kubernetes, host DNS) via environment configuration (`DNS_RESOLVER`).

**Non-Goals:**
- Replace NGINX with alternative reverse proxies (Traefik, Envoy, Caddy) or add external service mesh daemons.
- Rely on static IP address assignment in Docker Compose files.

## Decisions

### 1. Configure Native NGINX `resolver` with Docker DNS Default
- **Decision**: Define `resolver ${DNS_RESOLVER} valid=5s ipv6=off;` inside the `server` block (or `http` block), defaulting `DNS_RESOLVER` to `127.0.0.11`.
- **Why**: In Docker bridge networks, `127.0.0.11` is the standard embedded DNS server. Setting `ipv6=off` prevents unnecessary and failing AAAA DNS lookups that cause latency or resolution errors. Setting `valid=5s` bounds the maximum staleness after a container restart to 5 seconds.
- **Alternatives Considered**:
  - *Background DNS Watcher*: A background shell script executing `nginx -s reload` when IPs change. Rejected because it does not resolve the startup-order crash problem and adds unnecessary process complexity.
  - *NGINX Plus `server ... resolve`*: Not available in open-source `nginx:alpine`.

### 2. Upstream Target Variables in `server` Context
- **Decision**: Assign upstream base URLs to NGINX variables inside the `server` block:
  ```nginx
  set $auth_backend "${AUTH_SERVICE_URL}";
  set $product_backend "${PRODUCT_SERVICE_URL}";
  set $order_backend "${ORDER_SERVICE_URL}";
  set $user_backend "${USER_SERVICE_URL}";
  ```
- **Why**: NGINX triggers runtime DNS resolution via `resolver` ONLY when `proxy_pass` references a variable. If `proxy_pass` contains a static hostname string, NGINX bypasses runtime resolution and relies solely on startup-time DNS.

### 3. URI Path Propagation Strategy with Variables
- **Decision**:
  - For **pass-through versioned routes** where the incoming path matches the upstream path (e.g. `/api/v1/products/`):
    ```nginx
    location /api/v1/products/ {
        ...
        proxy_pass $product_backend$request_uri;
    }
    ```
    `$request_uri` passes the complete normalized path and query parameters as sent by the client.
  - For **unversioned aliases** requiring path rewriting (e.g. `/api/products/` -> `/api/v1/products/`):
    ```nginx
    location /api/products/ {
        ...
        rewrite ^/api/products/(.*)$ /api/v1/products/$1 break;
        proxy_pass $product_backend;
    }
    location = /api/products {
        ...
        rewrite ^ /api/v1/products break;
        proxy_pass $product_backend;
    }
    ```
    When `proxy_pass` is provided with only the variable without a trailing URI, NGINX forwards the rewritten URI including the query string.
  - For **subrequest verification** (`/_auth_verify` and `/_auth_verify_mutation_only`):
    ```nginx
    proxy_pass $auth_backend/api/auth/me;
    ```
  - For **exact static endpoints** (`/.well-known/jwks.json`):
    ```nginx
    proxy_pass $auth_backend/.well-known/jwks.json;
    ```
  - For **documentation routes**:
    Use appropriate `rewrite ... break;` rules to map paths like `/docs/products/scalar/` to `/docs/`.

### 4. Docker Environment Configuration
- **Decision**: Expose `DNS_RESOLVER=127.0.0.11` in `Dockerfile` and append `DNS_RESOLVER` to `NGINX_ENVSUBST_FILTER`.
- **Why**: Keeps internal NGINX variables (`$host`, `$req_id`, `$auth_backend`, etc.) protected from accidental replacement during `envsubst` execution while allowing operator overrides.

## Risks / Trade-offs

- **[Risk] Path truncation or argument loss on alias rewrites**
  → *Mitigation*: Cover all alias endpoints with automated unit tests asserting exact upstream path and query string forwarding in `tests/gateway-spec.test.mjs` and `tests/auth-flow.test.mjs`.

- **[Risk] Upstream keepalive connection caching**
  → *Mitigation*: In standard NGINX, dynamic variable proxying establishes standard HTTP/1.1 connections. With `proxy-params.conf` specifying `proxy_http_version 1.1`, connections remain performant for microservices workloads.

- **[Risk] Non-Docker deployment environments**
  → *Mitigation*: Operators running outside Docker can specify `DNS_RESOLVER=10.96.0.10` (Kubernetes) or their preferred DNS resolver without rebuilding the container.
