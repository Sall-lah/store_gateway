# Store Gateway (`store_gateway`)

[![NGINX Version](https://img.shields.io/badge/NGINX-1.25+-009639?style=flat&logo=nginx)](https://nginx.org/)
[![Base Image](https://img.shields.io/badge/Base%20Image-Alpine%20Linux-0D597F?logo=alpinelinux)](https://alpinelinux.org/)
[![Container](https://img.shields.io/badge/Container-Docker%20%7C%20Podman-2496ED?logo=docker)](https://www.docker.com/)
[![Tunnel](https://img.shields.io/badge/Tunnel-Cloudflare%20Zero%20Trust-F38020?logo=cloudflare)](https://www.cloudflare.com/)
[![Testing](https://img.shields.io/badge/Testing-Jest%20%2F%20Node.js-C21325?logo=jest)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade, high-performance API Gateway and Perimeter Reverse Proxy built on NGINX and Alpine Linux. It serves as the single unified entry point for the microservice ecosystem, orchestrating perimeter authentication offloading, anti-spoofing header sanitization, centralized CORS preflight caching, unified documentation proxying, distributed request tracing, and secure public ingress via embedded Cloudflare Zero Trust Tunnels.

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
  - [System Topology](#system-topology)
  - [Architectural Sequence Diagrams](#architectural-sequence-diagrams)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites & Environment Configuration](#-prerequisites--environment-configuration)
- [Route & Documentation Mapping Specification](#-route--documentation-mapping-specification)
- [Core Architectural Domains](#-core-architectural-domains)
- [Getting Started (Standalone Deployment)](#-getting-started-standalone-deployment)
- [Standalone Podman Deployment Guide](#-standalone-podman-deployment-guide)
- [Host Edge NGINX Reverse-Proxy Configuration](#-host-edge-nginx-reverse-proxy-configuration)
- [Cloudflare Tunnel Deployment & DNS CNAME Setup](#-cloudflare-tunnel-deployment--dns-cname-setup)
- [Local Testing & Verification](#-local-testing--verification)
- [Ecosystem Repositories](#-ecosystem-repositories)

---

## 🏗 Architecture Overview

### System Topology

```mermaid
flowchart TD
    Client[Clients: Web Frontend, Mobile, Curl, Postman] -->|HTTP / HTTPS| Gateway[Store Gateway: NGINX / Alpine]
    
    subgraph store_gateway ["Store Gateway Perimeter"]
        Gateway --> CORS[Centralized CORS: OPTIONS 204]
        Gateway --> AntiSpoof[Anti-Spoofing: Strip X-User-*]
        Gateway --> AuthOffload[Auth Offload Subrequest: /_auth_verify]
        Gateway --> SecHeaders[Security Headers & Trace ID]
        Gateway --> DocsProxy[Unified Documentation Hub: /docs]
    end

    AuthOffload -->|GET /api/auth/me| AuthSvc[Auth Service: port 8080]
    Gateway -->|Forward with Verified X-User-*| AuthSvc
    Gateway -->|Forward with Verified X-User-*| ProductSvc[Product Service: port 8040]
    Gateway -->|Forward with Verified X-User-*| OrderSvc[Order Service: port 8060]
    Gateway -->|Forward with Verified X-User-*| UserSvc[User Service: port 8082]
    
    CloudflareEdge[Cloudflare Edge Network] -->|Encrypted Zero Trust Tunnel| CFTunnel[cloudflared daemon]
    CFTunnel --> Gateway
```

### Architectural Sequence Diagrams

#### 1. Perimeter Authentication Offloading Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Frontend
    participant Gateway as Store Gateway (NGINX)
    participant Auth as Auth Service (8080)
    participant Upstream as Upstream Service (Products / Orders)

    Client->>Gateway: POST /api/v1/orders (Authorization: Bearer <jwt>)
    Note over Gateway: 1. Strip incoming untrusted X-User-* headers<br/>2. Issue internal subrequest to /_auth_verify
    Gateway->>Auth: GET /api/auth/me (Authorization, Cookie, X-Original-URI)
    
    alt Invalid / Expired Token
        Auth-->>Gateway: 401 Unauthorized
        Gateway-->>Client: 401 Unauthorized (Terminated at Perimeter)
    else Valid Token
        Auth-->>Gateway: 200 OK (X-User-Id: 101, X-User-Role: customer, X-User-Email: user@store.local)
        Note over Gateway: Inject verified X-User-* claims & X-Request-ID
        Gateway->>Upstream: POST /api/v1/orders (X-User-Id, X-User-Role, X-User-Email, X-Request-ID)
        Upstream-->>Gateway: 201 Created (Order Response Payload)
        Gateway-->>Client: 201 Created (+ CORS & Trace Response Headers)
    end
```

#### 2. Centralized CORS Preflight Flow

```mermaid
sequenceDiagram
    autonumber
    actor Browser as Browser Frontend
    participant Gateway as Store Gateway (NGINX)
    participant Upstream as Upstream Microservice

    Browser->>Gateway: OPTIONS /api/v1/orders (Origin, Access-Control-Request-Method)
    Note over Gateway: Intercept preflight without contacting upstreams.<br/>Evaluate origin and attach cached 24h CORS headers.
    Gateway-->>Browser: 204 No Content<br/>(Access-Control-Allow-Origin, Methods, Headers, Max-Age: 86400, Credentials: true)
    
    Browser->>Gateway: POST /api/v1/orders (Actual Request with Credentials)
    Gateway->>Upstream: Proxied Request (with Auth & Anti-Spoofing)
    Upstream-->>Gateway: Upstream Response
    Note over Gateway: Suppress upstream CORS duplicates via proxy_hide_header.<br/>Inject consolidated CORS headers.
    Gateway-->>Browser: Response (+ Access-Control-Allow-Origin, Credentials: true)
```

---

## 🌟 Key Features

1. **Perimeter Authentication Offloading**: Validates JWT credentials and bearer tokens against the Auth Service via internal NGINX subrequests before routing requests downstream.
2. **Anti-Spoofing Header Sanitization**: Strips untrusted incoming `X-User-*` client headers to ensure callers cannot spoof identity or escalate privileges.
3. **Centralized CORS Management**: Intercepts `OPTIONS` preflight requests, dynamically evaluates allowed origin regex, caches preflight for 24 hours, and suppresses duplicate upstream headers.
4. **Unified Documentation Proxying**: Serves an embedded API Documentation Hub (`/docs`) and dynamically proxies Scalar UI, Swagger UI, and OpenAPI schemas for all microservices.
5. **Distributed Request Tracing**: Injects unique UUID `$req_id` into downstream requests, upstream logs, and client response headers (`X-Request-ID`).
6. **Embedded Cloudflare Zero Trust Tunnel**: Integrated `cloudflared` client automatically exposes local and private VPC gateway instances to Cloudflare Edge without opening firewall ports.

---

## 🛠 Technology Stack

- **Reverse Proxy & Web Server**: [NGINX 1.25+](https://nginx.org/) on Alpine Linux
- **Edge Ingress & Tunneling**: [Cloudflare Zero Trust (`cloudflared`)](https://github.com/cloudflare/cloudflared)
- **Containerization**: Multi-stage [Docker](https://www.docker.com/) and rootless [Podman](https://podman.io/)
- **Configuration Templating**: `envsubst` / NGINX `docker-entrypoint.d` lifecycle hooks
- **Test Automation**: Node.js ESM test runner (`node:test`) & Mock Upstream Suite
- **API Documentation**: Scalar UI, Swagger UI, and OpenAPI 3.x specifications

---

## 📁 Repository Structure

```
store_gateway/
├── Dockerfile                           # Multi-stage Alpine NGINX + cloudflared container build
├── .env.example                         # Environment configuration template
├── .gitignore                           # Git ignore definitions (protects .env and .agent)
├── .dockerignore                        # Docker build context exclusions
├── package.json                         # Node.js test scripts and module definitions
├── scripts/
│   └── 40-start-cloudflared.sh          # Container startup hook for Cloudflare Tunnel
├── nginx/
│   ├── nginx.conf                       # Main NGINX context with trace ID mapping & logging
│   ├── templates/
│   │   └── default.conf.template        # Dynamic virtual host envsubst template
│   └── snippets/
│       ├── cors.conf                    # Centralized CORS & OPTIONS 204 preflight handler
│       ├── anti-spoofing.conf           # Anti-spoofing sanitization (strips client X-User-*)
│       ├── auth-offload.conf            # Full perimeter auth offloading & claim injection
│       ├── auth-offload-mutation.conf   # Mutation-only auth offloading for public read routes
│       ├── proxy-params.conf            # Reverse proxy headers, connection reuse & trace ID
│       └── security-headers.conf        # Defense-in-depth security response headers
├── tests/
│   ├── auth-flow.test.mjs               # E2E authentication offload and anti-spoofing tests
│   └── gateway-spec.test.mjs            # NGINX configuration and route contract tests
└── README.md                            # Comprehensive documentation & developer guide
```

---

## ⚙️ Prerequisites & Environment Configuration

### Prerequisites
- **Docker**: Version 20.10+ (or **Podman** 4.0+)
- **Node.js**: Version 18.x+ (for running automated test suite)
- **Cloudflare Zero Trust Account**: (Optional, for public edge tunneling)

### Configuration Options (`.env`)

Copy the example configuration file:
```bash
cp .env.example .env
```

| Variable Name | Type | Required | Default | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GATEWAY_PORT` | `int` | Optional | `80` | Port on which NGINX listens for incoming client requests | `80` or `8000` |
| `ENABLE_DOCS` | `bool` | Optional | `true` | Toggles documentation endpoints (`/docs*`). Set `false` in hardened production | `true` or `false` |
| `CORS_ALLOWED_ORIGIN_REGEX` | `string` | Optional | `^https?://(localhost\|127\.0\.0\.1)(:[0-9]+)?$` | Regex matching allowed client `Origin` headers for CORS reflection and credentials | `^https?://(localhost\|127\.0\.0\.1\|yourdomain\.com)(:[0-9]+)?$` |
| `AUTH_SERVICE_URL` | `string` | **Required** | *None* | Base HTTP URL of upstream Auth Service | `http://auth-service:8080` |
| `PRODUCT_SERVICE_URL` | `string` | **Required** | *None* | Base HTTP URL of upstream Product Service | `http://product-service:8040` |
| `ORDER_SERVICE_URL` | `string` | **Required** | *None* | Base HTTP URL of upstream Order Service | `http://order-service:8060` |
| `USER_SERVICE_URL` | `string` | **Required** | *None* | Base HTTP URL of upstream User Service | `http://user-service:8082` |
| `CLOUDFLARE_TUNNEL_TOKEN` | `string` | Optional | *None* | Base64 token for embedded Cloudflare Zero Trust Tunnel | `eyJhIjoi...` |

---

## 🗺️ Route & Documentation Mapping Specification

| Gateway Route | Methods | Upstream Target | Auth Policy | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET /health` | `GET` | *Gateway Internal* | Public | Healthcheck probe returning `200 UP` (access log disabled) |
| `ALL /api/v1/auth/*` (or `/api/auth/*`) | `ANY` | `${AUTH_SERVICE_URL}/api/auth/*` | Public / Self-enforced | Login, register, token refresh cookies, user profile |
| `GET /.well-known/jwks.json` | `GET, OPTIONS` | `${AUTH_SERVICE_URL}/.well-known/jwks.json` | Public | RS256 JWKS public key set for token verification |
| `ALL /api/v1/products/*` (or `/api/products/*`) | `ANY` | `${PRODUCT_SERVICE_URL}/api/v1/products/*` | Mutation-Only Auth | Product catalog: `GET/HEAD` public; `POST/PUT/DELETE` require auth |
| `ALL /api/v1/admin/products/*` (or `/api/admin/products/*`) | `ANY` | `${PRODUCT_SERVICE_URL}/api/v1/admin/products/*` | Full Auth Offload | Admin product management: all methods require verified caller identity |
| `ALL /api/v1/orders/*` (or `/api/orders/*`) | `ANY` | `${ORDER_SERVICE_URL}/api/v1/orders/*` | Full Auth Offload | Order processing: all mutations require verified caller identity |
| `ALL /api/v1/users/*` (or `/api/users/*`) | `ANY` | `${USER_SERVICE_URL}/api/users/*` | Full Auth Offload | User profile, notifications, preferences, and account lifecycle |
| `GET /docs` | `GET` | *Gateway Internal* | Conditional (`ENABLE_DOCS`) | Unified API Documentation Hub landing page (HTML) |
| `GET /docs/auth` | `GET` | `${AUTH_SERVICE_URL}/docs/` | Conditional (`ENABLE_DOCS`) | Auth Service Swagger UI (302 redirects to `/docs/auth/`) |
| `GET /docs/auth/openapi.yaml` | `GET` | `${AUTH_SERVICE_URL}/docs/openapi.yaml` | Conditional (`ENABLE_DOCS`) | Auth Service raw OpenAPI YAML schema |
| `GET /docs/products/scalar` (or `/docs/products`) | `GET` | `${PRODUCT_SERVICE_URL}/docs/` | Conditional (`ENABLE_DOCS`) | Product Service modern Scalar documentation UI |
| `GET /docs/products/swagger` | `GET` | `${PRODUCT_SERVICE_URL}/swagger/` | Conditional (`ENABLE_DOCS`) | Product Service classic Swagger documentation UI |
| `GET /docs/products/openapi.json` | `GET` | `${PRODUCT_SERVICE_URL}/openapi.json` | Conditional (`ENABLE_DOCS`) | Product Service raw OpenAPI JSON schema |
| `GET /docs/products/openapi.yaml` | `GET` | `${PRODUCT_SERVICE_URL}/openapi.yaml` | Conditional (`ENABLE_DOCS`) | Product Service raw OpenAPI YAML schema |
| `GET /docs/orders/scalar` (or `/docs/orders`) | `GET` | `${ORDER_SERVICE_URL}/docs` | Conditional (`ENABLE_DOCS`) | Order Service modern Scalar documentation UI |
| `GET /docs/orders/swagger` | `GET` | `${ORDER_SERVICE_URL}/swagger` | Conditional (`ENABLE_DOCS`) | Order Service classic Swagger documentation UI |
| `GET /docs/orders/openapi.json` | `GET` | `${ORDER_SERVICE_URL}/docs/openapi.json` | Conditional (`ENABLE_DOCS`) | Order Service raw OpenAPI JSON schema |
| `GET /docs/orders/openapi.yaml` | `GET` | `${ORDER_SERVICE_URL}/docs/openapi.yaml` | Conditional (`ENABLE_DOCS`) | Order Service raw OpenAPI YAML schema |
| `GET /docs/users` (or `/docs/users/swagger`) | `GET` | `${USER_SERVICE_URL}/swagger` | Conditional (`ENABLE_DOCS`) | User Service interactive Swagger documentation UI |
| `GET /docs/users/openapi.json` | `GET` | `${USER_SERVICE_URL}/docs/openapi.json` | Conditional (`ENABLE_DOCS`) | User Service raw OpenAPI JSON schema |
| `GET /docs/users/openapi.yaml` | `GET` | `${USER_SERVICE_URL}/docs/openapi.yaml` | Conditional (`ENABLE_DOCS`) | User Service raw OpenAPI YAML schema |

---

## 🔐 Core Architectural Domains

### 1. Perimeter Authentication Offloading
- Protected routes evaluate caller credentials by executing an internal subrequest to `${AUTH_SERVICE_URL}/api/auth/me`.
- **Full Auth Offload (`snippets/auth-offload.conf`)**: Enforces authentication on all non-OPTIONS requests.
- **Mutation-Only Offload (`snippets/auth-offload-mutation.conf`)**: Allows `GET`, `HEAD`, and `OPTIONS` requests to pass through anonymously, while requiring verified credentials for mutating operations (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Claim Injection**: Upon successful auth verification (HTTP 200), claims from the auth response (`X-User-Id`, `X-User-Role`, `X-User-Email`) are extracted and injected into the downstream proxy request.
- **Perimeter Rejection**: If authentication fails, the gateway rejects the caller with HTTP 401 Unauthorized immediately, shielding upstream microservices from unauthenticated traffic.

### 2. Anti-Spoofing Header Sanitization (`snippets/anti-spoofing.conf`)
- The gateway strips all incoming client headers prefixed with `X-User-` (`X-User-Id`, `X-User-Email`, `X-User-Role`, `X-User-Permissions`).
- Only verified claims produced by the gateway's internal authentication subrequest are forwarded downstream, preventing privilege escalation.

### 3. Centralized CORS Management (`snippets/cors.conf`)
- Intercepts all browser `OPTIONS` preflight requests and immediately responds with `204 No Content`.
- Caches preflight responses for 24 hours (`Access-Control-Max-Age: 86400`).
- Dynamically matches incoming `Origin` against `CORS_ALLOWED_ORIGIN_REGEX` environment variable, safely reflecting allowed origins instead of insecure `*` wildcards.
- Supports credentials (`Access-Control-Allow-Credentials: true`) when request origin matches the configured regex.
- Suppresses upstream CORS headers using `proxy_hide_header Access-Control-Allow-Origin` to avoid duplicate header parsing errors in browsers.

### 4. Unified Documentation Proxying
- Proxies interactive documentation UIs (Scalar UI and Swagger UI) and raw schema files (JSON and YAML) across all microservices.
- Gated by the `ENABLE_DOCS` environment variable: when set to `false`, `0`, or `off`, all documentation endpoints return `404 Not Found` for production security.

### 5. Distributed Tracing & Defense-in-Depth (`snippets/security-headers.conf`)
- Generates a unique `$req_id` (UUID format) if omitted by client and attaches it as `X-Request-ID` across downstream requests, upstream logs, and client response headers.
- Emits baseline security headers on every response:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`

---

## 🚀 Getting Started (Standalone Deployment)

### 1. Copy Environment Configuration
```bash
cp .env.example .env
```

Configure `.env` with your downstream service hostnames, CORS pattern, and ports:
```ini
# Gateway Configuration
GATEWAY_PORT=80
ENABLE_DOCS=true

# Downstream Microservices
AUTH_SERVICE_URL=http://auth-service:8080
PRODUCT_SERVICE_URL=http://product-service:8040
ORDER_SERVICE_URL=http://order-service:8060
USER_SERVICE_URL=http://user-service:8082

# Allowed Origins Regex for CORS
CORS_ALLOWED_ORIGIN_REGEX=^https?://(localhost|127\.0\.0\.1|([a-zA-Z0-9-]+\.)*yourdomain\.com)(:[0-9]+)?$

# Cloudflare Tunnel Token (optional)
CLOUDFLARE_TUNNEL_TOKEN=
```

### 2. Build and Run Standalone Docker Container
```bash
# Build the gateway image
docker build -t store_gateway .

# Run standalone container
docker run -d \
  --name store_gateway \
  -p 80:80 \
  --env-file .env \
  store_gateway
```

### 3. Verify Gateway Readiness
```bash
curl http://localhost/health
```

---

## 📦 Standalone Podman Deployment Guide

Podman allows rootless container management without requiring Docker daemon. You can deploy `store_gateway` and downstream microservices using either **User Networks** or **Podman Pods**.

### Approach A: Standalone Containers on a Podman Network

This approach uses a dedicated bridge network for service discovery by container name.

```bash
# 1. Create a user-defined Podman network
podman network create store_net

# 2. Run downstream microservices on the network
podman run -d --name auth-service --network store_net -e PORT=8080 store_auth:latest
podman run -d --name product-service --network store_net -e PORT=8040 product_service:latest
podman run -d --name order-service --network store_net -e PORT=8060 order_service:latest
podman run -d --name user-service --network store_net -e PORT=8082 user_service:latest

# 3. Build and run store_gateway connected to the network
podman build -t store_gateway .

podman run -d \
  --name store_gateway \
  --network store_net \
  -p 8000:80 \
  -e GATEWAY_PORT=80 \
  -e CORS_ALLOWED_ORIGIN_REGEX="^https?://(localhost|127\.0\.0\.1|yourdomain\.com|.+\.yourdomain\.com)(:[0-9]+)?$" \
  -e AUTH_SERVICE_URL=http://auth-service:8080 \
  -e PRODUCT_SERVICE_URL=http://product-service:8040 \
  -e ORDER_SERVICE_URL=http://order-service:8060 \
  -e USER_SERVICE_URL=http://user-service:8082 \
  -e ENABLE_DOCS=true \
  store_gateway

# 4. Check gateway status
curl http://localhost:8000/health
```

---

### Approach B: Podman Pod (Shared Network Namespace)

In a Podman Pod, all containers share `localhost` networking and port namespaces, eliminating the need for inter-container DNS.

```bash
# 1. Create a Pod exposing gateway port (8000) and frontend port (3000)
podman pod create \
  --name store_pod \
  -p 8000:80 \
  -p 3000:3000

# 2. Launch microservices inside the pod (binding to localhost ports)
podman run -d --pod store_pod --name auth-service -e PORT=8080 store_auth:latest
podman run -d --pod store_pod --name product-service -e PORT=8040 product_service:latest
podman run -d --pod store_pod --name order-service -e PORT=8060 order_service:latest
podman run -d --pod store_pod --name user-service -e PORT=8082 user_service:latest
podman run -d --pod store_pod --name frontend-app -e PORT=3000 frontend:latest

# 3. Launch store_gateway inside the pod pointing to localhost upstreams
podman run -d \
  --pod store_pod \
  --name store_gateway \
  -e GATEWAY_PORT=80 \
  -e CORS_ALLOWED_ORIGIN_REGEX="^https?://(localhost|127\.0\.0\.1|yourdomain\.com|.+\.yourdomain\.com)(:[0-9]+)?$" \
  -e AUTH_SERVICE_URL=http://127.0.0.1:8080 \
  -e PRODUCT_SERVICE_URL=http://127.0.0.1:8040 \
  -e ORDER_SERVICE_URL=http://127.0.0.1:8060 \
  -e USER_SERVICE_URL=http://127.0.0.1:8082 \
  -e ENABLE_DOCS=true \
  store_gateway
```

---

## 🌐 Host Edge NGINX Reverse-Proxy Configuration

In production single-server deployments, a **Host Edge NGINX** instance terminates SSL/TLS (e.g. via Let's Encrypt / Certbot) and proxies public traffic to the frontend and API gateway containers.

```
                    Internet (HTTPS 443)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   https://yourdomain.com           https://api.yourdomain.com
            │                                 │
  ┌─────────────────────────────────────────────────────┐
  │              HOST EDGE NGINX (Host OS)              │
  │        (SSL Termination, HTTP/2, Certbot)           │
  └─────────┬─────────────────────────────────┬─────────┘
            │ proxy_pass                      │ proxy_pass
            ▼ http://127.0.0.1:3000           ▼ http://127.0.0.1:8000
    ┌───────────────┐                 ┌───────────────┐
    │ Frontend App  │                 │ STORE GATEWAY │
    │  (Container)  │                 │  (Container)  │
    └───────────────┘                 └───────────────┘
```

### Sample Host Edge NGINX Server Block (`/etc/nginx/sites-available/store.conf`)

```nginx
# 1. Redirect HTTP to HTTPS for all domains
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# 2. Frontend Application (yourdomain.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

# 3. API Gateway Backend (api.yourdomain.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        # Proxy to store_gateway container port
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket support (for realtime notifications if enabled)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_read_timeout 90s;
        proxy_buffering off;
    }
}
```

---

## ☁️ Cloudflare Tunnel Deployment & DNS CNAME Setup

When deploying `store_gateway` in local development, home/office networks (CGNAT), or private cloud VPCs without public ingress, you can use the **embedded Cloudflare Tunnel** to securely expose your API without opening any router or firewall ports.

```
[Client / Browser: https://api.yourdomain.com]
                       │
                       ▼
             [Cloudflare Edge Network]
         (DDoS Protection, WAF, SSL Termination)
                       │
                       ▲ (Outbound Encrypted Tunnel)
                       │ (Bypasses CGNAT & Firewalls)
         ┌─────────────┴──────────────────────────────┐
         │       STORE_GATEWAY CONTAINER              │
         │                                            │
         │   [cloudflared (background)]               │
         │               │                            │
         │               ▼ (http://localhost:80)      │
         │   [NGINX Gateway Router (foreground)]      │
         │               │                            │
         │       ┌───────┴───────┐                    │
         │       ▼               ▼                    │
         │   Auth Service   Product Service ...       │
         └────────────────────────────────────────────┘
```

### 1. Cloudflare Zero Trust Configuration

1. Log into the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** ➔ **Tunnels** ➔ **Add a tunnel**.
3. Select **Cloudflare** (Connector) and give it a name (e.g. `store-gateway-tunnel`).
4. **Copy the Connector Token (`eyJhIjoi...`)**:
   - Under **Install and run a connector**, select **Docker** (or any OS).
   - Copy the long token string starting with `eyJh...` and paste it into your `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.
   - *(Note: Do not confuse the Connector Token with the Tunnel UUID; the token is the Base64 JWT required for the container to authenticate).*
5. **Configure Public Hostname**:
   - Switch to the **Public Hostname** tab in your tunnel settings.
   - **Subdomain**: `api`
   - **Domain**: `yourdomain.com` (or your registered domain)
   - **Service Type**: **`HTTP`** *(do NOT select `HTTPS`)*
   - **URL**: `localhost:80` (or `127.0.0.1:80`)
6. Save the hostname. Cloudflare will automatically manage the `CNAME` record pointing `api.yourdomain.com` to `<tunnel-uuid>.cfargotunnel.com` with proxying enabled (🟠).

> [!IMPORTANT]
> **Service Type Must Be `HTTP`**:
> NGINX inside the container listens for plain HTTP on port 80, while Cloudflare Edge terminates public HTTPS/SSL. Selecting `HTTPS` in Zero Trust causes `cloudflared` to attempt a TLS handshake against port 80, resulting in `502 Bad Gateway` (`tls: first record does not look like a TLS handshake`).

### 2. Run Container with Cloudflare Tunnel

Once `CLOUDFLARE_TUNNEL_TOKEN` is set in your `.env` file, start the container:

**Using Docker:**
```bash
# Build the image with embedded cloudflared
docker build -t store_gateway .

# Run with environment file
docker run -d \
  --name store_gateway \
  --restart unless-stopped \
  -p 80:80 \
  -p 8000:80 \
  --env-file .env \
  store_gateway
```

**Using Podman (on existing `store_net`):**
```bash
# Build the image
podman build -t store_gateway .

# Run on the store network alongside microservices
podman run -d \
  --name store_gateway \
  --network store_net \
  --restart unless-stopped \
  -p 80:80 \
  -p 8000:80 \
  --env-file .env \
  store_gateway
```

> **Note**: If `CLOUDFLARE_TUNNEL_TOKEN` is omitted or empty, the container gracefully falls back to standalone NGINX mode.

---

## 🧪 Local Testing & Verification

### Run Automated Test Suite
```bash
npm test
```

### Manual Verification Curl Recipes

```bash
# 1. Health Probe (Expect 200 OK JSON {"status":"UP","service":"store_gateway"})
curl -i http://localhost/health

# 2. CORS Preflight Check - Localhost (Expect 204 No Content with CORS allow headers)
curl -i -X OPTIONS http://localhost/api/v1/orders \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"

# 2b. CORS Preflight Check - Custom Domain (When CORS_ALLOWED_ORIGIN_REGEX matches yourdomain.com)
curl -i -X OPTIONS http://localhost/api/v1/orders \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST"

# 3. RS256 JWKS Public Key Retrieval (Expect 200 OK with JWKS JSON)
curl -i http://localhost/.well-known/jwks.json

# 4. Public Product Catalog Access (Expect 200 OK without token)
curl -i http://localhost/api/v1/products

# 5. Protected Product Creation Without Token (Expect 401 Unauthorized)
curl -i -X POST http://localhost/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"title":"New Product","price":29.99}'

# 6. Admin Product Access Without Token (Expect 401 Unauthorized)
curl -i http://localhost/api/v1/admin/products

# 7. Anti-Spoofing Check: Fake X-User-Role on Mutating Route (Expect 401 Unauthorized)
curl -i -X POST http://localhost/api/v1/orders \
  -H "X-User-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":"item-1","qty":2}]}'

# 8. Authenticated Order Creation (Expect 201 Created with verified claims forwarded)
curl -i -X POST http://localhost/api/v1/orders \
  -H "Authorization: Bearer <valid_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":"item-1","qty":2}]}'

# 9. Authenticated Admin Product Creation (Expect 201 Created with verified claims forwarded)
curl -i -X POST http://localhost/api/v1/admin/products \
  -H "Authorization: Bearer <valid_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Admin Added Product","price":49.99}'

# 10. Authenticated User Profile Retrieval (Expect 200 OK with User Profile)
curl -i http://localhost/api/v1/users/profile \
  -H "Authorization: Bearer <valid_jwt_token>"

# 11. Unauthenticated User Route Access (Expect 401 Unauthorized)
curl -i http://localhost/api/v1/users/profile

# 12. Unified Documentation Hub (Expect 200 OK HTML)
curl -i http://localhost/docs

# 13. User Service Swagger UI Proxy (Expect 200 OK HTML)
curl -i http://localhost/docs/users/swagger

# 14. User Service OpenAPI YAML Schema (Expect 200 OK YAML)
curl -i http://localhost/docs/users/openapi.yaml
```

---

## 🌐 Ecosystem Repositories

The Sall-lah e-commerce platform is built as a distributed microservice architecture. Below is the complete catalog of ecosystem repositories:

| Repository | Tech Stack | Role & Responsibility |
| :--- | :--- | :--- |
| [**`store_gateway`**](https://github.com/Sall-lah/store_gateway) | NGINX, Alpine Linux, Cloudflare Tunnel | Perimeter API Gateway, auth offloading, CORS handling, trace propagation, unified API docs proxy |
| [**`store_auth`**](https://github.com/Sall-lah/store_auth) | Node.js, Express, RS256 JWT, Redis | Central identity provider, authentication, RS256 token issuance & JWKS key distribution |
| [**`store_user`**](https://github.com/Sall-lah/store_user) | Go, Chi, PostgreSQL, Kafka | User profiles, account settings, GDPR deletion, notifications feed & preference management |
| [**`store_product`**](https://github.com/Sall-lah/store_product) | Go, Chi, PostgreSQL, Kafka | Product catalog management, inventory tracking, category hierarchy, admin CRUD operations |
| [**`store_order`**](https://github.com/Sall-lah/store_order) | Go, Chi, PostgreSQL, Midtrans, Kafka | Order lifecycle state machine, Midtrans Snap token generation, webhooks, Transactional Outbox |
| [**`store_notification`**](https://github.com/Sall-lah/store_notification) | Go / Node.js, Kafka, WebSockets / SMTP | Asynchronous event notifications (order updates, user status, email & real-time alerts) |
| [**`store_proto`**](https://github.com/Sall-lah/store_proto) | Protocol Buffers, gRPC | Shared protobuf schemas, gRPC service contracts, and generated language bindings |

### Quick Access Links
- 🔐 **Auth Service**: [https://github.com/Sall-lah/store_auth](https://github.com/Sall-lah/store_auth)
- 👤 **User Service**: [https://github.com/Sall-lah/store_user](https://github.com/Sall-lah/store_user)
- 📦 **Product Service**: [https://github.com/Sall-lah/store_product](https://github.com/Sall-lah/store_product)
- 💳 **Order Service**: [https://github.com/Sall-lah/store_order](https://github.com/Sall-lah/store_order)
- 🔔 **Notification Service**: [https://github.com/Sall-lah/store_notification](https://github.com/Sall-lah/store_notification)
- 📑 **Protobuf Contracts**: [https://github.com/Sall-lah/store_proto](https://github.com/Sall-lah/store_proto)
- 🚪 **API Gateway**: [https://github.com/Sall-lah/store_gateway](https://github.com/Sall-lah/store_gateway)
