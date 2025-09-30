#!/bin/bash
# Sistema y recursos necesarios
apt update -y && apt install -y git npm mysql-server

# Clonar la app en /home/ubuntu
cd /home/ubuntu
git clone https://github.com/Juampifm9/inventoryJPFM.git
cd /home/ubuntu/inventoryJPFM

# Dependencias Node
npm ci || npm install

# .env con valores fijos de la app (podés cambiarlos luego editando este archivo)
cat > /home/ubuntu/inventoryJPFM/.env <<'EOF'
PORT=80
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=invuser
DB_PASS=invpass
DB_NAME=inventory
EOF

# MySQL: encender y crear DB/usuario leyendo del .env
systemctl enable --now mysql
mysql <<SQL
CREATE DATABASE IF NOT EXISTS $(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_NAME") CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_USER")'@'localhost' IDENTIFIED BY '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_PASS")';
CREATE USER IF NOT EXISTS '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_USER")'@'127.0.0.1' IDENTIFIED BY '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_PASS")';
GRANT ALL PRIVILEGES ON $(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_NAME").* TO '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_USER")'@'localhost';
GRANT ALL PRIVILEGES ON $(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_NAME").* TO '$(. /home/ubuntu/inventoryJPFM/.env; printf %s "$DB_USER")'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# Iniciar la app (segundo plano)
npm start &
