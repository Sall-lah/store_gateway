#!/bin/sh
# Explain 'Why': Launches cloudflared in the background during container initialization
# if CLOUDFLARE_TUNNEL_TOKEN is set. NGINX will continue starting in the foreground as PID 1.

if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "==> [store_gateway] Starting Cloudflare Tunnel in background..."
    cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN" &
else
    echo "==> [store_gateway] CLOUDFLARE_TUNNEL_TOKEN not set. Running in standalone NGINX mode."
fi
