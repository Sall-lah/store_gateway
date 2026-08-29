## ADDED Requirements

### Requirement: Cloudflared Binary Inclusion
The container image SHALL include the precompiled static `cloudflared` binary and required CA certificates to enable TLS termination with Cloudflare Edge servers.

#### Scenario: Image build contains cloudflared binary
- **WHEN** the container image is built using the multi-stage Dockerfile
- **THEN** the `/usr/local/bin/cloudflared` binary is present, executable, and `ca-certificates` is installed

### Requirement: Conditional Background Startup
The container initialization lifecycle SHALL evaluate the `CLOUDFLARE_TUNNEL_TOKEN` environment variable and start `cloudflared` in the background before Nginx starts.

#### Scenario: Token provided at runtime
- **WHEN** the container starts with a non-empty `CLOUDFLARE_TUNNEL_TOKEN`
- **THEN** `cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"` is launched in the background and Nginx continues initialization in the foreground

#### Scenario: Token not provided at runtime
- **WHEN** the container starts without `CLOUDFLARE_TUNNEL_TOKEN` (or with an empty value)
- **THEN** a log message indicates tunnel startup is skipped and Nginx starts in standalone mode without error

### Requirement: Port and Protocol Compatibility
The embedded tunnel SHALL be capable of routing incoming HTTP traffic directly to the local Nginx gateway instance on the configured gateway port.

#### Scenario: Local Nginx traffic routing
- **WHEN** Cloudflare Edge routes a request over the tunnel to `localhost:80` (or the configured `GATEWAY_PORT`)
- **THEN** Nginx receives and processes the request according to its configured reverse proxy routes and headers
