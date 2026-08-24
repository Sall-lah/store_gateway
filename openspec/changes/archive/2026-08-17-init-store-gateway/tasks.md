## 1. Project Scaffolding & Configuration Structure

- [x] 1.1 Create project directory structure (`nginx/`, `nginx/templates/`, `nginx/snippets/`)
- [x] 1.2 Create core `nginx/nginx.conf` with optimized worker processes, connection limits, and access logging with `$request_id`
- [x] 1.3 Create `.env.example` defining default upstream URLs (`AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `GATEWAY_PORT`, `CORS_ALLOWED_ORIGINS`)

## 2. Reusable NGINX Snippets (CORS, Security & Anti-Spoofing)

- [x] 2.1 Create `nginx/snippets/cors.conf` implementing preflight OPTIONS (204) and dynamic `Access-Control-Allow-*` headers
- [x] 2.2 Create `nginx/snippets/anti-spoofing.conf` to strip untrusted incoming `X-User-*` client headers
- [x] 2.3 Create `nginx/snippets/proxy-params.conf` forwarding standard proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Request-ID`)
- [x] 2.4 Create `nginx/snippets/security-headers.conf` with defense-in-depth HTTP security headers

## 3. Reverse Proxy Routing & Environment Template

- [x] 3.1 Create `nginx/templates/default.conf.template` with upstream server blocks using environment variables
- [x] 3.2 Implement reverse proxy location blocks for `/api/auth/` and `/.well-known/jwks.json` to Auth Service
- [x] 3.3 Implement reverse proxy location block for `/api/products/` to Product Service
- [x] 3.4 Implement documentation proxy location blocks for `/docs/auth`, `/docs/products/scalar`, `/docs/products/swagger`, and raw OpenAPI JSON/YAML specs

## 4. Containerization & Orchestration

- [x] 4.1 Create `Dockerfile` based on `nginx:alpine` copying configuration and snippets
- [x] 4.2 Create `docker-compose.yml` defining the gateway service, network attachment, and environment variables
- [x] 4.3 Create `.dockerignore` and `.gitignore` ensuring environment files and sensitive files are ignored

## 5. Documentation & Verification

- [x] 5.1 Create `README.md` with architecture diagrams, routing tables, and local testing instructions
- [x] 5.2 Validate NGINX configuration syntax inside container environment
