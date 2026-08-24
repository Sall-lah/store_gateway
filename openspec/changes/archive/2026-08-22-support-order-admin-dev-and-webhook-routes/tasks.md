## 1. Gateway NGINX Configuration Updates

- [x] 1.1 Add dedicated location blocks for `/api/v1/orders/webhook/` and `/api/orders/webhook/` with CORS, anti-spoofing, and proxy headers without `auth-offload.conf`
- [x] 1.2 Add location blocks for `/api/v1/admin/orders/` and `/api/admin/orders/` with CORS, anti-spoofing, `auth-offload.conf`, and proxy headers forwarding to `${ORDER_SERVICE_URL}/api/v1/admin/orders`
- [x] 1.3 Add location blocks for `/api/v1/dev/orders/` and `/api/dev/orders/` with CORS, anti-spoofing, and proxy headers forwarding to `${ORDER_SERVICE_URL}/api/v1/dev/orders`

## 2. Gateway Verification & Integration Testing

- [x] 2.1 Reload or restart `store_gateway` container with updated configuration
- [x] 2.2 Verify unauthenticated payment webhook `POST /api/v1/orders/webhook/midtrans` reaches Order service without gateway 401 rejection
- [x] 2.3 Verify authenticated admin order requests `GET /api/v1/admin/orders` route to Order service with verified `X-User-Role` claims
- [x] 2.4 Verify dev simulation endpoints `POST /api/v1/dev/orders/:id/simulate-success` route to Order service without 404
