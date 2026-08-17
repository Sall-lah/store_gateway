# Store Gateway (NGINX API Gateway)

`store_gateway` is the single entry point and reverse proxy for the microservice ecosystem. It handles centralized CORS preflight, anti-spoofing header sanitization, documentation routing, and request tracing.

---

## 🏛️ Architecture Overview

```
                                  CLIENTS
                      (Web Frontend, Mobile, Curl, Postman)
                                     │
                                     │ HTTP (Port 80 / $GATEWAY_PORT)
                                     ▼
                    ┌─────────────────────────────────┐
                    │       STORE_GATEWAY (NGINX)      │
                    ├─────────────────────────────────┤
                    │ • Centralized CORS (OPTIONS 204)│
                    │ • Anti-Spoofing (Strip X-User-* │
                    │ • JWKS Pass-Through Routing     │
                    │ • Distributed Trace ID Injection│
                    │ • Unified Documentation Proxy   │
                    └───────┬─────────────────┬───────┘
                            │                 │
            /api/auth/*     │                 │  /api/products/*
            /docs/auth/*    │                 │  /docs/products/*
            /.well-known/*  │                 │
                            ▼                 ▼
             ┌─────────────────────┐   ┌─────────────────────┐
             │    AUTH SERVICE     │   │   PRODUCT SERVICE   │
             │ (auth-service:8080) │   │(product-service:8040│
             ├─────────────────────┤   ├─────────────────────┤
             │ • RS256 JWKS Key    │   │ • Product Catalog   │
             │   Distribution      │   │ • In-Memory JWKS    │
             │ • Login / Register  │   │   Token Validation  │
             │ • Swagger UI        │   │ • Scalar & Swagger  │
             └─────────────────────┘   └─────────────────────┘
```

---

## 🗺️ Route & Documentation Mapping

| Gateway Route | Upstream Target | Auth Policy | Description |
|---|---|---|---|
| `GET /health` | *Gateway internal* | Public | Healthcheck probe returning `200 UP` |
| `ALL /api/auth/*` | `${AUTH_SERVICE_URL}/api/auth/*` | Public / Self-enforced | Login, register, refresh cookie, `/me` |
| `GET /.well-known/jwks.json` | `${AUTH_SERVICE_URL}/.well-known/jwks.json` | Public | RS256 JWKS public key distribution |
| `ALL /api/products/*` | `${PRODUCT_SERVICE_URL}/api/products/*` | Public / In-Memory JWT | Product catalog & protected operations |
| `GET /docs` | *Gateway internal* | Public | Documentation hub landing page |
| `GET /docs/auth` | `${AUTH_SERVICE_URL}/docs` | Public | Auth Service Swagger UI |
| `GET /docs/auth/openapi.yaml` | `${AUTH_SERVICE_URL}/docs/openapi.yaml` | Public | Raw Auth OpenAPI 3.1 specification |
| `GET /docs/products/scalar` | `${PRODUCT_SERVICE_URL}/docs` | Public | Product Service modern Scalar UI |
| `GET /docs/products/swagger` | `${PRODUCT_SERVICE_URL}/swagger` | Public | Product Service classic Swagger UI |
| `GET /docs/products/openapi.json` | `${PRODUCT_SERVICE_URL}/openapi.json` | Public | Raw Product OpenAPI 3.1 JSON spec |
| `GET /docs/products/openapi.yaml` | `${PRODUCT_SERVICE_URL}/openapi.yaml` | Public | Raw Product OpenAPI 3.1 YAML spec |

---

## 🔐 Security & Anti-Spoofing Architecture

1. **Gateway Pass-Through for JWKS**:
   - `store_auth` signs tokens using asymmetric RS256 and exposes public keys at `/.well-known/jwks.json`.
   - Downstream services cache this JWKS locally and verify incoming `Authorization: Bearer <jwt>` tokens in memory (0ms network latency).
2. **Anti-Spoofing Sanitization**:
   - The gateway automatically strips untrusted incoming `X-User-Id`, `X-User-Email`, `X-User-Role`, and `X-User-Permissions` headers from external clients.
3. **Centralized CORS**:
   - Gateway intercepts `OPTIONS` preflight requests and answers with `204 No Content`.
   - Dynamic origin reflection for allowed clients with credentials support.
   - Upstream CORS headers are suppressed via `proxy_hide_header` to prevent browser duplicate header errors.

---

## 🚀 Quick Start

### 1. Copy Environment Configuration
```bash
cp .env.example .env
```

### 2. Start Gateway with Docker Compose
```bash
docker compose up -d --build
```

### 3. Verify Health
```bash
curl http://localhost/health
```

---

## 🧪 Local Testing & Verification

```bash
# 1. Health Probe
curl -i http://localhost/health

# 2. CORS Preflight Check
curl -i -X OPTIONS http://localhost/api/products \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"

# 3. JWKS Public Keys
curl -i http://localhost/.well-known/jwks.json

# 4. Anti-Spoofing Verification (Header Stripping)
curl -i http://localhost/api/products \
  -H "X-User-Id: spoofed-admin" \
  -H "Authorization: Bearer <token>"

# 5. Documentation Hub
curl -i http://localhost/docs
```

---

## 📁 File Structure

```
store_gateway/
├── Dockerfile                           # Lean Alpine-based NGINX image
├── docker-compose.yml                   # Container orchestration on store-network
├── .env.example                         # Environment variable definitions
├── .gitignore                           # Git ignore rules (protects .env and .agent)
├── .dockerignore                        # Docker build ignore rules
├── nginx/
│   ├── nginx.conf                       # Main context with request tracing & logging
│   ├── templates/
│   │   └── default.conf.template        # Virtual host envsubst template
│   └── snippets/
│       ├── cors.conf                    # Centralized CORS & OPTIONS 204 handler
│       ├── anti-spoofing.conf           # Header sanitization (strips X-User-*)
│       ├── proxy-params.conf            # Proxy headers & connection reuse
│       └── security-headers.conf        # Defense-in-depth security headers
└── README.md                            # Documentation & usage guide
```
