## 1. Startup Hook Script

- [x] 1.1 Create `scripts/40-start-cloudflared.sh` to conditionally launch `cloudflared` in the background when `CLOUDFLARE_TUNNEL_TOKEN` is present

## 2. Dockerfile Multi-Stage Integration

- [x] 2.1 Update `Dockerfile` with multi-stage build referencing `cloudflare/cloudflared:latest` and copy `/usr/local/bin/cloudflared`
- [x] 2.2 Install `ca-certificates` in the Alpine container for Cloudflare TLS handshake support
- [x] 2.3 Copy `scripts/40-start-cloudflared.sh` into `/docker-entrypoint.d/` with executable permissions

## 3. Documentation & Verification

- [x] 3.1 Update `README.md` with `CLOUDFLARE_TUNNEL_TOKEN` environment variable documentation and Cloudflare CNAME setup guide
- [x] 3.2 Verify Dockerfile syntax, build compatibility, and fallback behavior when the tunnel token is omitted
