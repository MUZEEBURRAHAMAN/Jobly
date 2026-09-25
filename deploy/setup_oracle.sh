#!/usr/bin/env bash
# ==============================================================================
# Hiring Radar - Oracle Cloud (OCI Always Free) Quick Setup Script
# Run this script on your Oracle Cloud Ubuntu instance:
#   chmod +x setup_oracle.sh && sudo ./setup_oracle.sh
# ==============================================================================

set -euo pipefail

echo "==> 1. Updating system packages and installing dependencies..."
sudo apt update -y
sudo apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx iptables-persistent curl

echo "==> 2. Configuring OS Firewall (OCI Ubuntu default blocks port 80 & 443)..."
# Insert accept rules at top of INPUT chain in iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "==> 3. Setting up Python virtual environment..."
PROJECT_DIR="/home/ubuntu/hiring-radar"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Creating directory $PROJECT_DIR..."
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

if [ ! -d "$PROJECT_DIR/.venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip
if [ -f "$PROJECT_DIR/backend/requirements.txt" ]; then
    pip install -r "$PROJECT_DIR/backend/requirements.txt"
fi

echo "==> 4. Installing Systemd Service..."
if [ -f "$PROJECT_DIR/deploy/hiring-radar.service" ]; then
    sudo cp "$PROJECT_DIR/deploy/hiring-radar.service" /etc/systemd/system/hiring-radar.service
    sudo systemctl daemon-reload
    sudo systemctl enable hiring-radar
    sudo systemctl restart hiring-radar
    echo "Hiring Radar systemd service enabled and started."
fi

echo "==> 5. Setting up Nginx..."
if [ -f "$PROJECT_DIR/deploy/nginx.conf" ]; then
    sudo cp "$PROJECT_DIR/deploy/nginx.conf" /etc/nginx/sites-available/hiring-radar
    sudo ln -sf /etc/nginx/sites-available/hiring-radar /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx
    echo "Nginx configured and restarted."
fi

echo "==> 6. Adding automated periodic sync cron job (every 2 hours)..."
CRON_CMD="0 */2 * * * curl -s -X POST http://127.0.0.1:8000/api/sync > /dev/null 2>&1"
(crontab -l 2>/dev/null | grep -Fv "/api/sync" ; echo "$CRON_CMD") | crontab -

echo "=============================================================================="
echo " Setup complete! Next steps:"
echo " 1. Make sure your domain's DNS A Record points to this Oracle VM public IP."
echo " 2. Update server_name in /etc/nginx/sites-available/hiring-radar with your domain."
echo " 3. Run: sudo certbot --nginx -d your-domain.com"
echo " 4. Verify API is working: curl https://your-domain.com/health"
echo "=============================================================================="
