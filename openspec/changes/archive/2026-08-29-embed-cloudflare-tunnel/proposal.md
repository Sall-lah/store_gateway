## Why

Deploying the gateway behind residential/office networks (CGNAT, dynamic public IPs) or restricted cloud VPCs without public ingress requires a zero-friction, secure mechanism to expose the API to the public internet. By embedding Cloudflare Tunnel (`cloudflared`) directly into the `store_gateway` container image, the gateway can be exposed securely via Cloudflare Anycast and DNS (e.g. `api.yourdomain.com`) with zero open inbound firewall ports and automatic SSL termination.

## What Changes

- **Embedded `cloudflared` Binary**: Leverage multi-stage Docker build to include the official static `cloudflared` binary into the `nginx:alpine` image with required CA certificates.
- **Automated Container Startup Hook**: Introduce a startup script in `/docker-entrypoint.d/` that detects `CLOUDFLARE_TUNNEL_TOKEN` and launches `cloudflared` in the background before Nginx starts.
- **Graceful Fallback**: If no `CLOUDFLARE_TUNNEL_TOKEN` is provided at runtime, the gateway functions normally as a standalone Nginx reverse proxy.
- **Documentation & Environment Updates**: Document tunnel token usage, DNS configuration with CNAME, and runtime environment options in `README.md`.

## Capabilities

### New Capabilities
- `cloudflare-tunnel`: Supports optional embedded Cloudflare Tunnel execution inside the container via `CLOUDFLARE_TUNNEL_TOKEN` to enable zero-ingress public edge connectivity and automated DNS mapping.

### Modified Capabilities
<!-- None: Existing Nginx routing, CORS, and auth-offloading requirements remain unchanged. -->

## Impact

- **Affected Code**: `Dockerfile`, new startup script (`scripts/40-start-cloudflared.sh`), and `README.md`.
- **Dependencies**: Adds `ca-certificates` in the Alpine container and copies `cloudflared` binary.
- **APIs & Routing**: Fully backwards compatible. No breaking changes to existing gateway routes, snippets, or upstream configurations.
