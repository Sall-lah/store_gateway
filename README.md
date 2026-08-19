# Store Gateway (NGINX API Gateway)

`store_gateway` is the single entry point and reverse proxy for the microservice ecosystem. It handles centralized CORS preflight, perimeter authentication offloading, anti-spoofing header sanitization, unified documentation proxying, and distributed request tracing.

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
                    │ • Auth Offload Subrequests      │
                    │ • JWKS Pass-Through Routing     │
                    │ • Distributed Trace ID Injection│
                    │ • Unified Documentation Proxy   │
                    └───────┬─────────┬─────────┬─────┘
                            │         │         │
    /api[/v1]/auth/*        │         │         │  /api[/v1]/orders/*
    /docs/auth/*            │         │         │  /docs/orders/*
    /.well-known/*          │         │         │
                            ▼         │         ▼
             ┌─────────────────────┐  │  ┌─────────────────────┐
             │    AUTH SERVICE     │  │  │    ORDER SERVICE    │
             │ (auth-service:8080) │  │  │ (order-service:8060) │
             ├─────────────────────┤  │  ├─────────────────────┤
             │ • RS256 JWKS Key    │  │  │ • Order Management  │
             │   Distribution      │  │  │ • Offloaded Auth    │
             │ • Login / Register  │  │  │ • Scalar & Swagger  │
             │ • Swagger UI        │  │  │ • OpenAPI Specs     │
             └─────────────────────┘  │  └─────────────────────┘
                                      │
                                      │  /api[/v1]/products/*
                                      │  /docs/products/*
                                      ▼
                        ┌─────────────────────┐
                        │   PRODUCT SERVICE   │
                        │(product-service:8040│
                        ├─────────────────────┤
                        │ • Product Catalog   │
                        │ • Offloaded Auth    │
                        │ • Scalar & Swagger  │
                        └─────────────────────┘
```

---

## 🗺️ Route & Documentation Mapping

| Gateway Route | Upstream Target | Auth Policy | Description |
|---|---|---|---|
| `GET /health` | *Gateway internal* | Public | Healthcheck probe returning `200 UP` |
| `ALL /api/v1/auth/*` (or `/api/auth/*`) | `${AUTH_SERVICE_URL}/api/v1/auth/*` | Public / Self-enforced | Login, register, refresh cookie, `/me` |
| `GET /.well-known/jwks.json` | `${AUTH_SERVICE_URL}/.well-known/jwks.json` | Public | RS256 JWKS public key distribution |
| `ALL /api/v1/products/*` (or `/api/products/*`) | `${PRODUCT_SERVICE_URL}/api/v1/products/*` | Public / Gateway Auth Offload | Product catalog (GET public, mutations require auth) |
| `ALL /api/v1/orders/*` (or `/api/orders/*`) | `${ORDER_SERVICE_URL}/api/v1/orders/*` | Public / Gateway Auth Offload | Orders (GET public/user, mutations require auth) |
| `GET /docs` | *Gateway internal* | Public | Documentation hub landing page |
| `GET /docs/auth` | `${AUTH_SERVICE_URL}/docs` | Public | Auth Service Swagger UI |
| `GET /docs/auth/openapi.yaml` | `${AUTH_SERVICE_URL}/docs/openapi.yaml` | Public | Raw Auth OpenAPI specification |
| `GET /docs/products/scalar` (or `/docs/products`) | `${PRODUCT_SERVICE_URL}/docs` | Public | Product Service modern Scalar UI |
| `GET /docs/products/swagger` | `${PRODUCT_SERVICE_URL}/swagger` | Public | Product Service classic Swagger UI |
| `GET /docs/products/openapi.json` | `${PRODUCT_SERVICE_URL}/openapi.json` | Public | Raw Product OpenAPI JSON spec |
| `GET /docs/products/openapi.yaml` | `${PRODUCT_SERVICE_URL}/openapi.yaml` | Public | Raw Product OpenAPI YAML spec |
| `GET /docs/orders/scalar` (or `/docs/orders`) | `${ORDER_SERVICE_URL}/docs` | Public | Order Service modern Scalar UI |
| `GET /docs/orders/swagger` | `${ORDER_SERVICE_URL}/swagger` | Public | Order Service classic Swagger UI |
| `GET /docs/orders/openapi.json` | `${ORDER_SERVICE_URL}/docs/openapi.json` | Public | Raw Order OpenAPI JSON spec |
| `GET /docs/orders/openapi.yaml` | `${ORDER_SERVICE_URL}/docs/openapi.yaml` | Public | Raw Order OpenAPI YAML spec |

---

## 🔐 Security & Anti-Spoofing Architecture

1. **Perimeter Authentication Offloading**:
   - The gateway intercepts mutating requests (POST, PUT, PATCH, DELETE) to protected downstream services.
   - Evaluates caller tokens via an internal subrequest to `${AUTH_SERVICE_URL}/api/v1/auth/me`.
   - On successful verification, extracts claims from auth response headers and injects verified `X-User-Id`, `X-User-Role`, and `X-User-Email` into downstream requests.
2. **Anti-Spoofing Sanitization**:
   - The gateway automatically strips untrusted incoming `X-User-*` headers from external clients, preventing header injection and privilege escalation.
3. **Centralized CORS**:
   - Gateway intercepts `OPTIONS` preflight requests and answers with `204 No Content`.
   - Dynamic origin reflection for allowed clients with credentials support.
   - Upstream CORS headers are suppressed via `proxy_hide_header` to prevent browser duplicate header errors.
4. **Conditional Documentation Availability**:
   - Setting `ENABLE_DOCS=false` instantly closes `/docs` and all downstream documentation endpoints with `404 Not Found` in production.

---

## 🚀 Quick Start (Standalone Deployment)

### 1. Copy Environment Configuration
```bash
cp .env.example .env
```

Configure `.env` with your downstream service hostnames and ports:
```ini
GATEWAY_PORT=80
ENABLE_DOCS=true
AUTH_SERVICE_URL=http://localhost:8080
PRODUCT_SERVICE_URL=http://localhost:8040
ORDER_SERVICE_URL=http://localhost:8060
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

## 🧪 Local Testing & Verification

Run the automated Node.js test suite:
```bash
npm test
```

Or perform manual verification:
```bash
# 1. Health Probe
curl -i http://localhost/health

# 2. CORS Preflight Check
curl -i -X OPTIONS http://localhost/api/v1/orders \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"

# 3. JWKS Public Keys
curl -i http://localhost/.well-known/jwks.json

# 4. Anti-Spoofing Verification (Header Stripping on Orders)
curl -i -X POST http://localhost/api/v1/orders \
  -H "X-User-Id: spoofed-admin" \
  -H "Content-Type: application/json" \
  -d '{"items":[]}'

# 5. Documentation Hub
curl -i http://localhost/docs
```

---

## 📁 File Structure

```
store_gateway/
├── Dockerfile                           # Lean Alpine-based NGINX image
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
│       ├── auth-offload.conf            # Perimeter token subrequest verification & injection
│       ├── proxy-params.conf            # Proxy headers & connection reuse
│       └── security-headers.conf        # Defense-in-depth security headers
├── tests/
│   ├── auth-flow.test.mjs               # E2E authentication offload and anti-spoofing tests
│   └── gateway-spec.test.mjs            # NGINX configuration and contract tests
├── package.json                         # Test runner scripts
└── README.md                            # Documentation & usage guide
```
