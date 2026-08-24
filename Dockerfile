# API Gateway Dockerfile
# Explain 'Why': Alpine base minimizes container attack surface and keeps image size under 25MB.
FROM nginx:alpine

# Explain 'Why': NGINX_ENVSUBST_FILTER restricts envsubst to specific variables, preventing corruption of internal NGINX variables ($host, $req_id, etc.).
ENV NGINX_ENVSUBST_FILTER="GATEWAY_PORT|AUTH_SERVICE_URL|PRODUCT_SERVICE_URL|ORDER_SERVICE_URL|USER_SERVICE_URL|ENABLE_DOCS" \
    GATEWAY_PORT=80 \
    ENABLE_DOCS=true \
    AUTH_SERVICE_URL=http://auth-service:8080 \
    PRODUCT_SERVICE_URL=http://product-service:8040 \
    ORDER_SERVICE_URL=http://order-service:8060 \
    USER_SERVICE_URL=http://user-service:8082

# Explain 'Why': Replace default configuration with modular gateway config, snippets, and startup templates.
RUN rm -rf /etc/nginx/conf.d/* /etc/nginx/templates/*

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/snippets/ /etc/nginx/snippets/
COPY nginx/templates/ /etc/nginx/templates/

# Explain 'Why': Built-in healthcheck allows container orchestrators to monitor gateway readiness without third-party dependencies.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:${GATEWAY_PORT}/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
