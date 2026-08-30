# API Gateway Dockerfile
# Explain 'Why': Multi-stage build copies the precompiled static cloudflared binary 
# without adding extra build tools or bloat to the final image.
FROM cloudflare/cloudflared:latest AS cloudflared-bin

# Explain 'Why': Alpine base minimizes container attack surface and keeps image size lightweight.
FROM nginx:alpine

# Explain 'Why': Install ca-certificates so cloudflared can verify TLS connections to Cloudflare Edge.
RUN apk add --no-cache ca-certificates

# Explain 'Why': Copy cloudflared binary from the official image for embedded tunnel connectivity.
COPY --from=cloudflared-bin /usr/local/bin/cloudflared /usr/local/bin/cloudflared

# Explain 'Why': NGINX_ENVSUBST_FILTER restricts envsubst to specific variables, preventing corruption of internal NGINX variables ($host, $req_id, etc.).
ENV NGINX_ENVSUBST_FILTER="GATEWAY_PORT|AUTH_SERVICE_URL|PRODUCT_SERVICE_URL|ORDER_SERVICE_URL|USER_SERVICE_URL|ENABLE_DOCS|CORS_ALLOWED_ORIGIN_REGEX|DNS_RESOLVER" \
    GATEWAY_PORT=80 \
    ENABLE_DOCS=true \
    DNS_RESOLVER=127.0.0.11 \
    CORS_ALLOWED_ORIGIN_REGEX="^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$" \
    AUTH_SERVICE_URL=http://auth-service:8080 \
    PRODUCT_SERVICE_URL=http://product-service:8040 \
    ORDER_SERVICE_URL=http://order-service:8060 \
    USER_SERVICE_URL=http://user-service:8082

# Explain 'Why': Replace default configuration with modular gateway config, snippets, and startup templates.
RUN rm -rf /etc/nginx/conf.d/* /etc/nginx/templates/*

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/snippets/ /etc/nginx/snippets/
COPY nginx/templates/ /etc/nginx/templates/

# Explain 'Why': Sourced entrypoint script auto-detects nameserver from /etc/resolv.conf for seamless DNS resolution across Docker and Podman.
COPY scripts/15-detect-resolver.envsh /docker-entrypoint.d/15-detect-resolver.envsh
RUN chmod +x /docker-entrypoint.d/15-detect-resolver.envsh

# Explain 'Why': Add entrypoint script to automatically launch cloudflared during container initialization.
COPY scripts/40-start-cloudflared.sh /docker-entrypoint.d/40-start-cloudflared.sh
RUN chmod +x /docker-entrypoint.d/40-start-cloudflared.sh

# Explain 'Why': Built-in healthcheck allows container orchestrators to monitor gateway readiness without third-party dependencies.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:${GATEWAY_PORT}/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
