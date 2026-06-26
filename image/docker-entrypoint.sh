#!/bin/sh
set -eu

PUBLIC_HTTPS_PORT="${PUBLIC_HTTPS_PORT:-3000}"
ALLOW_PUBLIC_REGISTER="${ALLOW_PUBLIC_REGISTER:-true}"

case "$ALLOW_PUBLIC_REGISTER" in
  true|TRUE|1|yes|YES) allow_register=true ;;
  *) allow_register=false ;;
esac

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen 80;
  server_name _;
  return 301 https://\$host:${PUBLIC_HTTPS_PORT}\$request_uri;
}

server {
  listen 443 ssl http2;
  server_name _;

  ssl_certificate     /etc/nginx/ssl/cert.pem;
  ssl_certificate_key /etc/nginx/ssl/key.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;

  root /usr/share/nginx/html;
  index index.html;

  location = /config.json {
    add_header Cache-Control "no-store";
    try_files \$uri =404;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|wasm)\$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
EOF

cat > /usr/share/nginx/html/config.json <<EOF
{
  "seedAdminEmail": "${SEED_ADMIN_EMAIL:-}",
  "seedAdminPassword": "${SEED_ADMIN_PASSWORD:-}",
  "allowPublicRegister": ${allow_register}
}
EOF

exec nginx -g 'daemon off;'
