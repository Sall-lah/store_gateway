## ADDED Requirements

### Requirement: Dynamic Upstream DNS Resolution
The API gateway SHALL dynamically resolve upstream microservice hostnames (`AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`, `USER_SERVICE_URL`) at request runtime using an internal NGINX DNS resolver rather than permanently caching IP addresses at startup. The resolver SHALL enforce a short cache validity period (`valid=5s ipv6=off;`) with a default address of `127.0.0.11` (configurable via `DNS_RESOLVER`), ensuring that requests automatically adapt to new container IP addresses across restarts without restarting the gateway.

#### Scenario: Upstream container restart with new IP
- **WHEN** an upstream microservice container (e.g. `product-service`) restarts and acquires a new IP address on the Docker bridge network
- **THEN** the API gateway resolves the new container IP address within the configured resolver TTL and routes subsequent requests without returning persistent 502 Bad Gateway errors

#### Scenario: Gateway startup resilience before upstreams are ready
- **WHEN** the API gateway boots while one or more upstream microservices are temporarily initializing or unreachable on DNS
- **THEN** NGINX starts up successfully without failing configuration parsing or crashing on boot, and dynamically connects as soon as the upstream services register in DNS

#### Scenario: Custom DNS resolver configuration
- **WHEN** the gateway container is deployed with a custom `DNS_RESOLVER` environment variable (e.g. Kubernetes CoreDNS `10.96.0.10` or host resolver)
- **THEN** NGINX envsubst substitutes the configured resolver address into the virtual host configuration
