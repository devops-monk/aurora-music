#!/usr/bin/env bash
# Publishes site/ to the VPS as static files behind the existing nginx.
# Touches only /var/www/aurora-music and one nginx site (installed once).
#   usage: deploy/deploy-site.sh root@HOST
set -euo pipefail
HOST=${1:?usage: deploy-site.sh root@HOST}
HERE=$(cd "$(dirname "$0")" && pwd)
ssh "$HOST" 'install -d -m 755 /var/www/aurora-music'
rsync -az --delete "$HERE/../site/" "$HOST:/var/www/aurora-music/"
scp -q "$HERE/nginx-aurora-site.conf" "$HOST:/tmp/nginx-aurora-site.conf"
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
chmod -R a+rX /var/www/aurora-music
if [ ! -f /etc/nginx/sites-available/aurora-music-site ]; then
  install -m 644 /tmp/nginx-aurora-site.conf /etc/nginx/sites-available/aurora-music-site
  ln -sf /etc/nginx/sites-available/aurora-music-site /etc/nginx/sites-enabled/aurora-music-site
  if nginx -t; then systemctl reload nginx; else rm -f /etc/nginx/sites-enabled/aurora-music-site; echo "nginx test failed; site not enabled"; exit 1; fi
fi
rm -f /tmp/nginx-aurora-site.conf
REMOTE
echo "Published. For HTTPS once DNS resolves: ssh $HOST certbot --nginx -d aurora.devops-monk.com"
