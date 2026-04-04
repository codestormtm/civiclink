#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "[ERROR] Install failed at line $LINENO. Check the output above for details." >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$REPO_ROOT/scripts/ubuntu-install.env}"
DOCKER_ENV_FILE="$REPO_ROOT/docker/.env"
NGINX_SITE_FILE="/etc/nginx/sites-available/civiclink.conf"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/civiclink.conf"

log() {
  echo "[INFO] $*"
}

warn() {
  echo "[WARN] $*" >&2
}

die() {
  echo "[ERROR] $*" >&2
  exit 1
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Run this script with sudo or as root."
  fi
}

load_env_file_if_present() {
  local file_path="$1"
  if [[ -f "$file_path" ]]; then
    log "Loading values from $file_path"
    set -a
    # shellcheck disable=SC1090
    source "$file_path"
    set +a
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_apt_packages() {
  log "Installing Ubuntu packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gawk \
    git \
    gnupg \
    jq \
    lsb-release \
    nginx \
    software-properties-common
}

ensure_nodejs() {
  local install_node="false"

  if ! command_exists node; then
    install_node="true"
  else
    local current_major
    current_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ -z "$current_major" || "$current_major" -lt 22 ]]; then
      install_node="true"
    fi
  fi

  if [[ "$install_node" == "true" ]]; then
    log "Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    log "Node.js already installed: $(node -v)"
  fi
}

ensure_docker() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    log "Docker and Docker Compose plugin already installed"
    return
  fi

  log "Installing Docker Engine and Compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

enable_services() {
  log "Enabling Docker and Nginx"
  systemctl enable --now docker
  systemctl enable --now nginx
}

detect_server_host() {
  if [[ -n "${SERVER_HOST:-}" ]]; then
    return
  fi

  SERVER_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "$SERVER_HOST" ]]; then
    SERVER_HOST="$(hostname -f 2>/dev/null || hostname)"
  fi
}

set_defaults() {
  detect_server_host

  NODE_ENV="${NODE_ENV:-development}"
  MONITORING_ENABLED="${MONITORING_ENABLED:-true}"

  DB_USER="${DB_USER:-civic}"
  DB_PASSWORD="${DB_PASSWORD:-civic123}"
  DB_NAME="${DB_NAME:-civiclink}"
  DB_PORT="${DB_PORT:-5433}"

  BACKEND_PORT="${BACKEND_PORT:-5002}"
  PUBLIC_PORT="${PUBLIC_PORT:-5173}"
  ADMIN_PORT="${ADMIN_PORT:-5174}"
  WORKER_PORT="${WORKER_PORT:-5175}"
  MINIO_PORT="${MINIO_PORT:-9000}"
  MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"

  MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-admin}"
  MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-password123}"
  MINIO_BUCKET="${MINIO_BUCKET:-civiclink}"

  JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-1d}"
  JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

  ADMIN_NAME="${ADMIN_NAME:-System Admin}"
  ADMIN_EMAIL="${ADMIN_EMAIL:-sysadmin@civiclink.local}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)}"

  GROQ_API_KEY="${GROQ_API_KEY:-${GROQ_API_KEY_VALUE:-}}"

  FIREBASE_SERVICE_ACCOUNT_FILE="${FIREBASE_SERVICE_ACCOUNT_FILE:-}"
  FIREBASE_SERVICE_ACCOUNT_JSON="${FIREBASE_SERVICE_ACCOUNT_JSON:-}"
}

prepare_firebase_values() {
  if [[ -n "$FIREBASE_SERVICE_ACCOUNT_FILE" ]]; then
    [[ -f "$FIREBASE_SERVICE_ACCOUNT_FILE" ]] || die "FIREBASE_SERVICE_ACCOUNT_FILE not found: $FIREBASE_SERVICE_ACCOUNT_FILE"
    FIREBASE_SERVICE_ACCOUNT_JSON="$(jq -c . "$FIREBASE_SERVICE_ACCOUNT_FILE")"
  fi

  if [[ -n "$FIREBASE_SERVICE_ACCOUNT_JSON" ]]; then
    FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" | jq -r '.project_id // .projectId // empty')}"
  fi

  if [[ -n "${FIREBASE_PRIVATE_KEY:-}" && -n "${FIREBASE_CLIENT_EMAIL:-}" && -n "${FIREBASE_PROJECT_ID:-}" ]]; then
    return
  fi

  if [[ -n "$FIREBASE_SERVICE_ACCOUNT_JSON" ]]; then
    return
  fi

  if [[ -n "${FIREBASE_PROJECT_ID:-}" ]]; then
    warn "Firebase project ID is set without service account credentials. Citizen Firebase session exchange may not work until you add FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  fi
}

write_backend_env() {
  log "Writing backend/.env"
  {
    echo "PORT=$BACKEND_PORT"
    echo "NODE_ENV=$NODE_ENV"
    echo
    echo "DB_HOST=localhost"
    echo "DB_PORT=$DB_PORT"
    echo "DB_USER=$DB_USER"
    echo "DB_PASSWORD=$DB_PASSWORD"
    echo "DB_NAME=$DB_NAME"
    echo
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_EXPIRES_IN=$JWT_EXPIRES_IN"
    echo
    echo "MONITORING_HOST=$SERVER_HOST"
    echo "CLIENT_URL=http://$SERVER_HOST:$PUBLIC_PORT"
    echo "ADMIN_PORTAL_URL=http://$SERVER_HOST:$ADMIN_PORT"
    echo "WORKER_PORTAL_URL=http://$SERVER_HOST:$WORKER_PORT"
    echo "CITIZEN_PORTAL_URL=http://$SERVER_HOST:$PUBLIC_PORT"
    echo "TRANSPARENCY_PORTAL_URL=http://$SERVER_HOST:$PUBLIC_PORT/public"
    echo "BACKEND_API_URL=http://$SERVER_HOST:$BACKEND_PORT/api/health/app"
    echo
    echo "MINIO_ENDPOINT=localhost"
    echo "MINIO_PORT=$MINIO_PORT"
    echo "MINIO_PUBLIC_URL=http://$SERVER_HOST:$MINIO_PORT"
    echo "MINIO_URL=http://$SERVER_HOST:$MINIO_PORT"
    echo "MINIO_USE_SSL=false"
    echo "MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY"
    echo "MINIO_SECRET_KEY=$MINIO_SECRET_KEY"
    echo "MINIO_BUCKET=$MINIO_BUCKET"
    echo
    [[ -n "$GROQ_API_KEY" ]] && echo "GROQ_API_KEY=$GROQ_API_KEY"
    [[ -n "${FIREBASE_PROJECT_ID:-}" ]] && echo "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID"
    [[ -n "${FIREBASE_CLIENT_EMAIL:-}" ]] && echo "FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL"
    [[ -n "${FIREBASE_PRIVATE_KEY:-}" ]] && printf 'FIREBASE_PRIVATE_KEY="%s"\n' "$FIREBASE_PRIVATE_KEY"
    [[ -n "$FIREBASE_SERVICE_ACCOUNT_JSON" ]] && printf 'FIREBASE_SERVICE_ACCOUNT_JSON=%s\n' "$FIREBASE_SERVICE_ACCOUNT_JSON"
  } >"$REPO_ROOT/backend/.env"
}

write_compose_env() {
  log "Writing docker/.env"
  cat >"$DOCKER_ENV_FILE" <<EOF
SERVER_HOST=$SERVER_HOST
NODE_ENV=$NODE_ENV
MONITORING_ENABLED=$MONITORING_ENABLED
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_PORT=$DB_PORT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=$JWT_EXPIRES_IN
BACKEND_PORT=$BACKEND_PORT
PUBLIC_PORT=$PUBLIC_PORT
ADMIN_PORT=$ADMIN_PORT
WORKER_PORT=$WORKER_PORT
MINIO_PORT=$MINIO_PORT
MINIO_CONSOLE_PORT=$MINIO_CONSOLE_PORT
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET=$MINIO_BUCKET
EOF
}

write_frontend_env_files() {
  log "Writing production frontend env files"

  cat >"$REPO_ROOT/web-public/.env.production" <<EOF
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=
EOF

  if [[ -n "${VITE_FIREBASE_API_KEY:-}" ]]; then
    cat >>"$REPO_ROOT/web-public/.env.production" <<EOF
VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
EOF
  else
    warn "web-public Firebase client values are missing. Public email/Google login will stay disabled until you add them."
  fi

  cat >"$REPO_ROOT/web-admin/.env.production" <<EOF
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=
EOF

  cat >"$REPO_ROOT/web-worker/.env.production" <<EOF
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=
EOF
}

docker_compose() {
  docker compose --env-file "$DOCKER_ENV_FILE" -f "$REPO_ROOT/docker/docker-compose.yml" "$@"
}

start_infra_containers() {
  log "Starting Postgres, Redis, and MinIO"
  docker_compose up -d postgres redis minio
}

wait_for_postgres() {
  log "Waiting for Postgres to become ready"
  local attempts=0
  until docker exec civic_postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      die "Postgres did not become ready in time."
    fi
    sleep 2
  done
}

psql_query() {
  local sql="$1"
  docker exec -i civic_postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "$sql"
}

apply_sql_file() {
  local file_path="$1"
  log "Applying $(basename "$file_path")"
  docker exec -i civic_postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <"$file_path"
}

bootstrap_database() {
  log "Bootstrapping database"

  local has_departments_table
  has_departments_table="$(psql_query "SELECT to_regclass('public.departments') IS NOT NULL;")"
  has_departments_table="$(echo "$has_departments_table" | tr -d '[:space:]')"

  if [[ "$has_departments_table" != "t" ]]; then
    apply_sql_file "$REPO_ROOT/backend/sql/001_schema.sql"
  else
    log "Base schema already exists, skipping 001_schema.sql"
  fi

  local department_count
  department_count="$(psql_query "SELECT COUNT(*) FROM departments;")"
  department_count="$(echo "$department_count" | tr -d '[:space:]')"
  if [[ "$department_count" == "0" ]]; then
    apply_sql_file "$REPO_ROOT/backend/sql/002_seed.sql"
  else
    log "Seed departments already exist, skipping 002_seed.sql"
  fi

  apply_sql_file "$REPO_ROOT/backend/sql/002_intake_sessions.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/003_complaint_status_logs.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/004_complaint_location_fields.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/005_worker_termination_records.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/006_system_admin_monitoring.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/007_department_default_issue_type.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/008_password_reset_requests.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/009_firebase_auth.sql"
  apply_sql_file "$REPO_ROOT/backend/sql/010_attachment_roles.sql"
}

start_backend_container() {
  log "Building and starting backend container"
  docker_compose up -d --build backend
}

wait_for_backend() {
  log "Waiting for backend health endpoint"
  local attempts=0
  until curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health/app" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      die "Backend did not become healthy in time."
    fi
    sleep 2
  done
}

run_sla_migration() {
  log "Applying SLA fields migration"
  docker exec civic_backend node scripts/addSlaFields.js >/tmp/civiclink-sla.log 2>&1 || {
    cat /tmp/civiclink-sla.log >&2
    die "SLA migration failed."
  }
}

ensure_system_admin() {
  local escaped_email
  escaped_email="${ADMIN_EMAIL//\'/\'\'}"

  local admin_exists
  admin_exists="$(psql_query "SELECT EXISTS (SELECT 1 FROM users WHERE email = '$escaped_email');")"
  admin_exists="$(echo "$admin_exists" | tr -d '[:space:]')"

  if [[ "$admin_exists" == "t" ]]; then
    log "System admin already exists for $ADMIN_EMAIL"
    return
  fi

  log "Creating initial system admin"
  docker exec civic_backend npm run create:system-admin -- "$ADMIN_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
}

build_frontends() {
  local app_dir
  for app_dir in web-public web-admin web-worker; do
    log "Installing npm dependencies in $app_dir"
    (cd "$REPO_ROOT/$app_dir" && npm ci)
    log "Building $app_dir"
    (cd "$REPO_ROOT/$app_dir" && npm run build)
  done
}

write_nginx_config() {
  log "Writing Nginx site config"
  cat >"$NGINX_SITE_FILE" <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen $PUBLIC_PORT;
  server_name _;
  root $REPO_ROOT/web-public/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}

server {
  listen $ADMIN_PORT;
  server_name _;
  root $REPO_ROOT/web-admin/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}

server {
  listen $WORKER_PORT;
  server_name _;
  root $REPO_ROOT/web-worker/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

  ln -sf "$NGINX_SITE_FILE" "$NGINX_SITE_LINK"
  nginx -t
  systemctl reload nginx
}

open_firewall_ports_if_needed() {
  if command_exists ufw && ufw status | grep -q "Status: active"; then
    log "Opening ports in UFW"
    ufw allow "$PUBLIC_PORT"/tcp || true
    ufw allow "$ADMIN_PORT"/tcp || true
    ufw allow "$WORKER_PORT"/tcp || true
    ufw allow "$BACKEND_PORT"/tcp || true
    ufw allow "$MINIO_PORT"/tcp || true
    ufw allow "$MINIO_CONSOLE_PORT"/tcp || true
  fi
}

print_summary() {
  cat <<EOF

[INFO] CivicLink install completed.

Portal URLs
  Citizen portal:      http://$SERVER_HOST:$PUBLIC_PORT
  Transparency portal: http://$SERVER_HOST:$PUBLIC_PORT/public
  Admin portal:        http://$SERVER_HOST:$ADMIN_PORT
  Worker portal:       http://$SERVER_HOST:$WORKER_PORT
  Backend health:      http://$SERVER_HOST:$BACKEND_PORT/api/health/app
  MinIO API:           http://$SERVER_HOST:$MINIO_PORT
  MinIO console:       http://$SERVER_HOST:$MINIO_CONSOLE_PORT

Database
  Host: localhost
  Port: $DB_PORT
  Name: $DB_NAME
  User: $DB_USER

Initial system admin
  Name: $ADMIN_NAME
  Email: $ADMIN_EMAIL
  Password: $ADMIN_PASSWORD

Notes
  - Docker services are managed with: docker compose --env-file docker/.env -f docker/docker-compose.yml up -d
  - If Google/Firebase citizen login is needed, add $SERVER_HOST to Firebase Authorized domains.
  - If backend Firebase session exchange is needed, supply Firebase Admin service account credentials and rerun this script.
EOF
}

main() {
  require_root
  cd "$REPO_ROOT"

  load_env_file_if_present "$REPO_ROOT/backend/.env"
  load_env_file_if_present "$REPO_ROOT/web-public/.env"
  load_env_file_if_present "$CONFIG_FILE"

  set_defaults
  prepare_firebase_values

  ensure_apt_packages
  ensure_nodejs
  ensure_docker
  enable_services

  write_backend_env
  write_compose_env
  write_frontend_env_files

  start_infra_containers
  wait_for_postgres
  bootstrap_database
  start_backend_container
  wait_for_backend
  run_sla_migration
  ensure_system_admin

  build_frontends
  write_nginx_config
  open_firewall_ports_if_needed
  print_summary
}

main "$@"
