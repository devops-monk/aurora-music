#!/usr/bin/env bash
# Builds the party server and installs it on a VPS that already runs nginx.
# Touches only: /opt/aurora-party, the aurora-party user and unit, and one nginx site.
#   usage: deploy/deploy.sh root@HOST [path-to-BitChord/backend]
set -euo pipefail
HOST=${1:?usage: deploy.sh root@HOST [backend-dir]}
BACKEND=${2:-../BitChord/backend}
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$(mktemp -d)

(cd "$BACKEND" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$OUT/aurora-party" .)
scp "$OUT/aurora-party" "$HERE/aurora-party.service" "$HERE/nginx-aurora-party.conf" "$HOST:/tmp/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
id aurora-party >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin aurora-party
install -d -m 755 /opt/aurora-party
install -m 755 /tmp/aurora-party /opt/aurora-party/aurora-party
install -m 644 /tmp/aurora-party.service /etc/systemd/system/aurora-party.service
systemctl daemon-reload
systemctl enable aurora-party >/dev/null
systemctl restart aurora-party
sleep 1
curl -fsS http://127.0.0.1:8765/healthz >/dev/null && echo "party server healthy on 127.0.0.1:8765"

# The nginx site is installed once; after certbot has added TLS to it, leave it alone.
if [ ! -f /etc/nginx/sites-available/aurora-party ]; then
  install -m 644 /tmp/nginx-aurora-party.conf /etc/nginx/sites-available/aurora-party
  ln -sf /etc/nginx/sites-available/aurora-party /etc/nginx/sites-enabled/aurora-party
  if nginx -t; then systemctl reload nginx; else rm -f /etc/nginx/sites-enabled/aurora-party; echo "nginx config test failed; site not enabled"; exit 1; fi
fi
rm -f /tmp/aurora-party /tmp/aurora-party.service /tmp/nginx-aurora-party.conf
REMOTE
rm -rf "$OUT"
echo "Done. For HTTPS once DNS resolves: ssh $HOST certbot --nginx -d party.devops-monk.com"
