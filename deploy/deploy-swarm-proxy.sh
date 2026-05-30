#!/usr/bin/env bash
# =============================================================================
# Deploy Swarm Proxy for colaboraEDU Analytics
# Routes traffic from Traefik Swarm Service to Host on Port 3005
# =============================================================================
set -euo pipefail

SERVICE_NAME="analytics_proxy"
NETWORK_NAME="edocBRnet"
HOST_IP="185.187.170.35"
APP_PORT="3005"
DOMAIN="analytics.colaboraedu.cloud"

echo "Checking if proxy service already exists..."
if sudo docker service inspect "$SERVICE_NAME" &>/dev/null; then
  echo "Removing existing proxy service..."
  sudo docker service rm "$SERVICE_NAME"
  sleep 2
fi

echo "Creating Nginx-based Traefik router on Swarm network '$NETWORK_NAME'..."

sudo docker service create \
  --name "$SERVICE_NAME" \
  --network "$NETWORK_NAME" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.analytics.rule=Host(\`${DOMAIN}\`)" \
  --label "traefik.http.routers.analytics.entrypoints=websecure" \
  --label "traefik.http.routers.analytics.tls=true" \
  --label "traefik.http.routers.analytics.tls.certresolver=letsencryptresolver" \
  --label "traefik.http.services.analytics.loadbalancer.server.port=80" \
  --restart-condition any \
  nginx:alpine \
  sh -c "echo 'server {
    listen 80;
    client_max_body_size 100M;
    location / {
        proxy_pass http://${HOST_IP}:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600;
        proxy_connect_timeout 3600;
        proxy_send_timeout 3600;
    }
}' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"

echo "✅ Swarm proxy service created successfully!"
sudo docker service ps "$SERVICE_NAME"
