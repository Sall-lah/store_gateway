# Design: Support Order Admin, Dev Simulation, and Webhook Routes

## Context

The `store_gateway` serves as the single entry point reverse proxy for all client traffic across Auth, Product, and Order services. Currently:
1. All requests under `/api/v1/orders/` include `auth-offload.conf` which enforces an internal `auth_request /_auth_verify;` subrequest to `store_auth`.
2. New endpoints in `store_order` for administrative management (`/api/v1/admin/orders`) and developer testing (`/api/v1/dev/orders/*`) use path prefixes that are not matched by existing NGINX location blocks, resulting in `404 Not Found`.
3. External webhooks from payment providers (such as Midtrans at `/api/v1/orders/webhook/midtrans`) are rejected with `401 Unauthorized` because external notification callers do not have user authentication cookies or Bearer tokens.

## Goals / Non-Goals

**Goals:**
- Enable reverse proxying for `/api/v1/admin/orders/` and `/api/admin/orders/` with full token verification and verified identity claim injection (`X-User-Id`, `X-User-Role`, `X-User-Email`).
- Enable reverse proxying for `/api/v1/dev/orders/` and `/api/dev/orders/` with CORS and anti-spoofing protection.
- Exempt `/api/v1/orders/webhook/` and `/api/orders/webhook/` from the gateway's `auth_request` subrequest to allow external server-to-server callbacks to reach `store_order`.
- Maintain perimeter security by stripping untrusted client-supplied `X-User-*` headers across all new location blocks.

**Non-Goals:**
- Validating external payment gateway webhook signatures inside NGINX (signature verification is downstream business logic handled by `store_order`).
- Restricting `/api/v1/dev/orders/*` by IP address or environment flags in NGINX in this change.

## Decisions

### 1. Leverage NGINX Longest-Prefix Matching for Webhook Bypass
* **Decision**: Define dedicated `location /api/v1/orders/webhook/` and `location /api/orders/webhook/` blocks without `include /etc/nginx/snippets/auth-offload.conf;`.
* **Rationale**: NGINX evaluates standard prefix locations by choosing the most specific (longest) match. A request to `/api/v1/orders/webhook/midtrans` will match `location /api/v1/orders/webhook/` instead of `location /api/v1/orders/`, avoiding any messy `if` conditions or regex matches.
* **Alternatives Considered**: Using an `if ($request_uri ~* "webhook")` condition inside the main order location block (rejected due to NGINX `if` in location directive caveats and reduced readability).

### 2. Admin Route Protection Model
* **Decision**: Include `auth-offload.conf` in `/api/v1/admin/orders/` blocks.
* **Rationale**: Admin routes require authenticated callers. Offloading verification at the perimeter ensures `store_order` receives validated `X-User-Role` headers to perform its role-based access control (RBAC) checks.

### 3. Maintain Canonical and v1 Alias Parity
* **Decision**: Add both `/api/v1/<prefix>` and `/api/<prefix>` location blocks for each new route group.
* **Rationale**: Matches existing gateway architecture conventions established for auth, products, and orders.

## Risks / Trade-offs

- **[Risk] Unauthenticated Access to Webhook Routes**: Allowing unauthenticated access to `/api/v1/orders/webhook/` could allow malicious callers to send fake webhook payloads.
  - **Mitigation**: `anti-spoofing.conf` is explicitly included in the webhook block to ensure caller cannot forge `X-User-*` claims. Downstream `store_order` cryptographically validates the SHA512 signature on incoming Midtrans webhook payloads before taking action.

## Migration Plan

1. Edit [nginx/templates/default.conf.template](file:///C:/Users/LENOVO/Documents/VsCode/GitHub/store_gateway/nginx/templates/default.conf.template) to add the new location blocks.
2. Validate NGINX template syntax and reload/restart the `store_gateway` container.
3. Run the automated verification script to confirm:
   - `GET /api/v1/admin/orders` returns `200` (or `403` if non-admin, instead of `404`).
   - `POST /api/v1/dev/orders/:id/simulate-success` returns valid upstream response.
   - `POST /api/v1/orders/webhook/midtrans` returns valid upstream response (no `401` from gateway).
