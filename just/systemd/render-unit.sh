#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

mode="$1"
service_name="$2"
project_root="$3"
env_file_input="$4"
host="$5"
port="$6"
data_dir_input="$7"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

require_command node

project_root="$(resolve_path "${project_root}" "$(pwd)")"
env_file="$(resolve_path "${env_file_input}" "${project_root}")"
data_dir="$(resolve_path "${data_dir_input}" "${project_root}")"
node_bin="${NODE_BIN:-$(command -v node)}"
db_path="${data_dir%/}/app.db"
server_js="${project_root}/.next/standalone/server.js"

ensure_file_exists "${env_file}"

if [ "${mode}" = "system" ]; then
  service_user="${SERVICE_USER:-$(id -un)}"
  service_group="${SERVICE_GROUP:-$(id -gn "${service_user}")}"
  install_target="multi-user.target"
else
  service_user=""
  service_group=""
  install_target="default.target"
fi

node_bin_quoted="$(systemd_quote "${node_bin}")"
server_js_quoted="$(systemd_quote "${server_js}")"
node_env_line="$(systemd_quote "NODE_ENV=production")"
host_env_line="$(systemd_quote "HOSTNAME=${host}")"
port_env_line="$(systemd_quote "PORT=${port}")"
data_dir_env_line="$(systemd_quote "DATA_DIR=${data_dir}")"
db_path_env_line="$(systemd_quote "PROMPT_ASSET_DB_PATH=${db_path}")"
node_options_env_line="$(systemd_quote "NODE_OPTIONS=--enable-source-maps")"

cat <<EOF
[Unit]
Description=${service_name} Next.js service
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
EOF

if [ "${mode}" = "system" ]; then
  printf 'User=%s\n' "${service_user}"
  printf 'Group=%s\n' "${service_group}"
fi

cat <<EOF
WorkingDirectory=${project_root}
Environment=${node_env_line}
Environment=${host_env_line}
Environment=${port_env_line}
Environment=${data_dir_env_line}
Environment=${db_path_env_line}
Environment=${node_options_env_line}
EnvironmentFile=${env_file}
ExecStart=${node_bin_quoted} ${server_js_quoted}
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30
NoNewPrivileges=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=${install_target}
EOF
