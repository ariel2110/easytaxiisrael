# RideOS Platform — VPS Hardening Guide

> Apply these steps **in order** on a fresh Ubuntu 22.04 / Debian 12 VPS
> before deploying the Docker stack.

---

## 1 · Create a non-root sudo user

```bash
adduser rideos
usermod -aG sudo rideos
# Switch to the new user for all remaining steps
su - rideos
```

---

## 2 · SSH hardening

### 2.1 Disable root login and password auth

```bash
sudo nano /etc/ssh/sshd_config
```

Set / confirm these values:

```ini
PermitRootLogin          no
PasswordAuthentication   no
PubkeyAuthentication     yes
AuthorizedKeysFile       .ssh/authorized_keys
X11Forwarding            no
AllowAgentForwarding     no
MaxAuthTries             3
LoginGraceTime           30s
```

### 2.2 Change the SSH port (optional but recommended)

```ini
Port 2222    # pick any unused port above 1024
```

### 2.3 Reload SSH

```bash
sudo systemctl reload sshd
# Verify you can still connect on the new port BEFORE closing the current session
```

### 2.4 Copy your public key to the server

```bash
# Run this locally:
ssh-copy-id -i ~/.ssh/id_ed25519.pub -p 2222 rideos@YOUR_VPS_IP
```

---

## 3 · Firewall (UFW)

```bash
sudo apt install -y ufw

# Default policy
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (use your custom port if changed)
sudo ufw allow 2222/tcp

# Allow HTTP/HTTPS (Nginx handles these)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable
sudo ufw status verbose
```

> **Never** open port 8000 (FastAPI) or 5432 (Postgres) or 6379 (Redis)
> directly. All traffic must go through Nginx.

---

## 4 · Fail2ban (brute-force protection)

```bash
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled  = true
port     = 2222   # match your SSH port
logpath  = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled  = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl enable --now fail2ban
sudo fail2ban-client status
```

---

## 5 · System updates (automated)

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Choose "Yes" to enable automatic security updates
```

---

## 6 · Docker security

```bash
# Install Docker (official repo)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker rideos

# Verify Docker daemon is NOT exposing the socket over TCP
# /etc/docker/daemon.json should NOT contain "hosts": ["tcp://..."]
cat /etc/docker/daemon.json 2>/dev/null || echo "{}"
```

Run the stack with:

```bash
cd ~/rideos-platform/infra
cp ../.env.example .env
# Edit .env: set strong secrets for JWT_SECRET_KEY, ENCRYPTION_KEY,
# POSTGRES_PASSWORD, REDIS_PASSWORD
nano .env

docker compose up -d
```

---

## 7 · HTTPS with Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot

# Stop Nginx briefly to allow standalone challenge
docker compose stop nginx

sudo certbot certonly --standalone \
  -d YOUR_DOMAIN \
  --email YOUR_EMAIL \
  --agree-tos \
  --non-interactive

# Copy certs to the Nginx certs folder
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem infra/nginx/certs/
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem   infra/nginx/certs/
sudo chown -R rideos:rideos infra/nginx/certs/

# Update nginx.conf: replace YOUR_DOMAIN with your actual domain
sed -i 's/YOUR_DOMAIN/your.domain.com/g' infra/nginx/nginx.conf

docker compose start nginx
```

### 7.1 Auto-renewal

```bash
# Cron job runs twice daily (Let's Encrypt best practice)
(crontab -l 2>/dev/null; echo "0 3,15 * * * certbot renew --quiet && \
  docker compose -f ~/rideos-platform/infra/docker-compose.yml exec nginx \
  nginx -s reload") | crontab -
```

---

## 8 · PostgreSQL / Redis — localhost binding

Both services are bound inside the Docker network only and are **not**
accessible from the host or internet when following this guide.
Confirm with:

```bash
# Should return no results (no public-facing DB ports)
sudo ss -tlnp | grep -E '5432|6379'
```

---

## 9 · Log management

```bash
# Rotate Docker logs (add to /etc/docker/daemon.json)
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
EOF
sudo systemctl restart docker
```

---

## 10 · Backups

```bash
# Daily Postgres dump
sudo tee /etc/cron.d/rideos-backup <<'EOF'
0 2 * * * rideos docker exec rideos-platform-postgres-1 \
  pg_dump -U rideos rideos | gzip \
  > /home/rideos/backups/rideos-$(date +\%Y\%m\%d).sql.gz
EOF

mkdir -p ~/backups
```

---

## Security checklist

- [ ] Root login disabled
- [ ] SSH key auth only (no passwords)
- [ ] SSH port changed
- [ ] UFW enabled, only ports 80/443/SSH open
- [ ] Fail2ban active
- [ ] Automated security updates enabled
- [ ] HTTPS certificate installed and auto-renewing
- [ ] Strong secrets in `.env` (not `.env.example` values)
- [ ] Postgres & Redis not exposed externally
- [ ] Docker log rotation configured
- [ ] Daily database backup scheduled
