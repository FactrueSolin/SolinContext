#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

mode="$1"
service_name="$2"
project_root_input="$3"
env_file_input="$4"
host="$5"
port="$6"
data_dir_input="$7"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

require_command systemctl
require_command node

project_root="$(resolve_path "${project_root_input}" "$(pwd)")"
env_file="$(resolve_path "${env_file_input}" "${project_root}")"
data_dir="$(resolve_path "${data_dir_input}" "${project_root}")"
server_js="${project_root}/.next/standalone/server.js"
render_script="${script_dir}/render-unit.sh"

ensure_file_exists "${env_file}"
ensure_file_exists "${server_js}"
ensure_directory_exists "${data_dir}"

tmp_file="$(mktemp)"
trap 'rm -f "${tmp_file}"' EXIT

"${render_script}" "${mode}" "${service_name}" "${project_root}" "${env_file}" "${host}" "${port}" "${data_dir}" > "${tmp_file}"

unit_name="${service_name}.service"

if [ "${mode}" = "user" ]; then
  unit_dir="${HOME}/.config/systemd/user"
  ensure_directory_exists "${unit_dir}"
  install -m 0644 "${tmp_file}" "${unit_dir}/${unit_name}"
  systemctl --user daemon-reload
  systemctl --user enable --now "${unit_name}"
else
  unit_dir="/etc/systemd/system"
  maybe_sudo install -d -m 0755 "${unit_dir}"
  maybe_sudo install -m 0644 "${tmp_file}" "${unit_dir}/${unit_name}"
  maybe_sudo systemctl daemon-reload
  maybe_sudo systemctl enable --now "${unit_name}"
fi

printf 'Installed %s (%s mode)\n' "${unit_name}" "${mode}"
