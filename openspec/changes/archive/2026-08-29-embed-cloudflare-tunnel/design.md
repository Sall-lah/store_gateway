## Context

The `store_gateway` is an Nginx-based API Gateway packaged as an Alpine Docker container (`nginx:alpine`). It handles reverse proxy routing, CORS headers, security policies, and documentation aggregation. When deployed on local hardware, residential networks (CGNAT), or private cloud VPCs, exposing the gateway typically requires firewall port forwarding or third-party reverse proxies. Embedding Cloudflare Tunnel directly into the container allows seamless outbound edge tunneling and CNAME-based DNS mapping without open ports.

## Goals / Non-Goals

**Goals:**
- Package the official `cloudflared` binary into the `store_gateway` container via a multi-stage Docker build.
- Add an automated, non-blocking entrypoint hook (`/docker-entrypoint.d/40-start-cloudflared.sh`) that starts the tunnel when `CLOUDFLARE_TUNNEL_TOKEN` is supplied.
- Maintain full backward compatibility for standalone deployments where no tunnel token is set.
- Ensure the gateway can receive traffic on `http://localhost:80` (or configured `GATEWAY_PORT`) forwarded by the co-located `cloudflared` process.

**Non-Goals:**
- Managing Cloudflare API credentials or generating tunnel tokens automatically from within the container (tokens are provisioned in Cloudflare Zero Trust and passed as environment variables).
- Replacing Nginx with Cloudflare ingress routing rules (Nginx remains the authoritative router for upstream microservices).

## Decisions

### 1. Multi-stage Docker Build (`FROM cloudflare/cloudflared:latest`)
- **Decision**: Copy `/usr/local/bin/cloudflared` from the official `cloudflare/cloudflared` image into `nginx:alpine` and install `ca-certificates`.
- **Why**: Avoids manual curl/wget URL downloads and architecture mismatches; keeps the build reproducible and image size minimal (~40-60MB delta).
- **Alternatives considered**:
  - *Download via apk/tarball*: More brittle across architectures and versions.
  - *Separate sidecar container*: User explicitly requested an all-in-one embedded container deployment.

### 2. Startup Lifecycle Integration via `/docker-entrypoint.d/`
- **Decision**: Place an executable shell script `scripts/40-start-cloudflared.sh` mapped to `/docker-entrypoint.d/40-start-cloudflared.sh`.
- **Why**: The official `nginx:alpine` entrypoint automatically executes all `.sh` scripts in `/docker-entrypoint.d/` prior to running `nginx -g "daemon off;"`. Launching `cloudflared` in the background (`&`) allows Nginx to retain PID 1 in the foreground for signal handling (e.g., graceful shutdown).
- **Alternatives considered**:
  - *Supervisord / s6-overlay*: Adds unnecessary complexity and dependencies when a background shell hook is sufficient.
  - *Custom ENTRYPOINT replacing Nginx's default*: Would break Nginx's built-in `envsubst` template handling.

### 3. DNS Integration via Cloudflare CNAME
- **Decision**: Document CNAME mapping (`api.yourdomain.com` ➔ `<tunnel-uuid>.cfargotunnel.com`) with Cloudflare Orange Cloud (Proxied) mode.
- **Why**: Cloudflare automatically creates this record when public hostnames are created in the Zero Trust dashboard.

## Risks / Trade-offs

- **[Risk] Container restart terminates tunnel** ➔ **Mitigation**: Use container restart policies (`restart: unless-stopped`) and health checks to maintain high availability.
- **[Risk] Missing CA certificates on Alpine base** ➔ **Mitigation**: Explicitly install `ca-certificates` in the Dockerfile so TLS handshakes with Cloudflare Edge servers succeed.
- **[Risk] Empty or invalid token hanging startup** ➔ **Mitigation**: Script checks for non-empty string `-n "$CLOUDFLARE_TUNNEL_TOKEN"` before launching and runs `cloudflared` with `--no-autoupdate`.

## Migration Plan

1. Create `scripts/40-start-cloudflared.sh` with executable permissions.
2. Update `Dockerfile` with multi-stage build and entrypoint hook copy.
3. Update `README.md` with environment variable table and Cloudflare Tunnel instructions.
4. Verify local image build and container startup both with and without `CLOUDFLARE_TUNNEL_TOKEN`.
