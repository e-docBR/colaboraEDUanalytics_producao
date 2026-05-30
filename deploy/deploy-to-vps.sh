#!/usr/bin/env bash
# =============================================================================
# Deploy colaboraEDU Analytics → VPS
# URL: https://analytics.colaboraedu.cloud
# VPS: 185.187.170.35
# =============================================================================
set -euo pipefail

VPS_IP="185.187.170.35"
VPS_USER="suporte"
REMOTE_DIR="/var/www/colaboraEDUanalytics"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "============================================="
echo " colaboraEDU Analytics — Deploy to VPS"
echo "============================================="
echo "Local project: $LOCAL_DIR"
echo "Remote target: $VPS_USER@$VPS_IP:$REMOTE_DIR"
echo ""

# ── Step 1: Sync project files ──────────────────────────────────────────────
echo "[1/7] Syncing project files to VPS..."
# Ensure remote directory exists and is owned by suporte so rsync can write
ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "sudo mkdir -p \"$REMOTE_DIR\" && sudo chown -R $VPS_USER:$VPS_USER \"$REMOTE_DIR\""

rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='db/*.db' \
  --exclude='db/*.sqlite' \
  --exclude='uploads/' \
  --exclude='upload/' \
  --exclude='.agents/' \
  --exclude='.codex/' \
  --exclude='.zscripts/' \
  --exclude='colaboraEDUanalytics' \
  --exclude='*.Zone.Identifier' \
  --exclude='*:Zone.Identifier' \
  --exclude='bun.lock' \
  --exclude='*.log' \
  "$LOCAL_DIR/" "$VPS_USER@$VPS_IP:$REMOTE_DIR/"

echo ""
echo "[2/7] Running remote setup..."

# ── Steps 2-7: Remote commands ──────────────────────────────────────────────
ssh "$VPS_USER@$VPS_IP" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_DIR="/var/www/colaboraEDUanalytics"
cd "$REMOTE_DIR"

# Stop existing service to release file locks on node_modules
sudo systemctl stop analytics-colaboraedu || true

echo ""
echo "[3/7] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "  → Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "  → Node.js: $(node -v)"
echo "  → npm:     $(npm -v)"

echo ""
echo "[3/7] Checking Caddy..."
if ! command -v caddy &>/dev/null; then
  echo "  → Installing Caddy..."
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
fi
echo "  → Caddy:   $(caddy version)"

echo ""
echo "[4/7] Installing dependencies..."
rm -rf node_modules
npm ci

echo ""
echo "[4/7] Setting up environment..."
# Only create .env if it doesn't already exist
if [ ! -f .env ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  SEED_ADMIN_TOKEN=$(openssl rand -hex 32)
  cat > .env <<ENVFILE
DATABASE_URL="file:${REMOTE_DIR}/db/custom.db"
PROJECT_ROOT="${REMOTE_DIR}"
PYTHON_BIN="/usr/bin/python3"
SESSION_SECRET="${SESSION_SECRET}"
SEED_ADMIN_TOKEN="${SEED_ADMIN_TOKEN}"
INITIAL_ADMIN_EMAIL="admin@colaboraedu.cloud"
INITIAL_ADMIN_PASSWORD="TroqueEstaSenha123!"
ENVFILE
  echo "  → .env created (CHANGE the admin password!)"
else
  echo "  → .env already exists, keeping current"
  # Ensure DATABASE_URL and PROJECT_ROOT are correct for VPS
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:${REMOTE_DIR}/db/custom.db\"|" .env
  sed -i "s|^PROJECT_ROOT=.*|PROJECT_ROOT=\"${REMOTE_DIR}\"|" .env
fi

echo ""
echo "[5/7] Setting up database..."
mkdir -p db uploads/pdfs
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push

echo ""
echo "[6/7] Building Next.js (standalone)..."
npm run build

echo ""
echo "[7/7] Configuring Caddy and systemd..."

# Install Caddyfile
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy || sudo systemctl restart caddy
sudo systemctl enable caddy

# Install systemd service
sudo cp deploy/analytics-colaboraedu.service /etc/systemd/system/analytics-colaboraedu.service

# Set ownership
sudo chown -R www-data:www-data "$REMOTE_DIR"

# Reload and start service
sudo systemctl daemon-reload
sudo systemctl enable analytics-colaboraedu
sudo systemctl restart analytics-colaboraedu

echo ""
echo "============================================="
echo " Deploy complete!"
echo "============================================="
echo ""
echo "Checking service status..."
sleep 3
sudo systemctl status analytics-colaboraedu --no-pager || true

echo ""
echo "Testing local connectivity..."
curl -s -o /dev/null -w "HTTP status: %{http_code}\n" http://127.0.0.1:3005 || echo "  → App may still be starting..."

echo ""
echo "======================================================="
echo " Next steps:"
echo "  1. Configure Cloudflare DNS (A record: analytics → ${VPS_IP:-185.187.170.35})"
echo "  2. Set SSL/TLS mode to 'Full (strict)' in Cloudflare"
echo "  3. Visit: https://analytics.colaboraedu.cloud"
echo "  4. Create admin: curl -X POST https://analytics.colaboraedu.cloud/api/auth/seed -H 'x-seed-token: YOUR_TOKEN'"
echo "======================================================="
REMOTE_SCRIPT

echo ""
echo "✅ Deploy finished!"
