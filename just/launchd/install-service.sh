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

require_command launchctl
require_command node

project_root="$(resolve_path "${project_root_input}" "$(pwd)")"
env_file="$(resolve_path "${env_file_input}" "${project_root}")"
data_dir="$(resolve_path "${data_dir_input}" "${project_root}")"
server_js="${project_root}/.next/standalone/server.js"
render_script="${script_dir}/render-plist.sh"

ensure_file_exists "${env_file}"
ensure_file_exists "${server_js}"
ensure_directory_exists "${data_dir}"

label="cn.actrue.prompt.${service_name}"
plist_name="${label}.plist"

tmp_file="$(mktemp)"
trap 'rm -f "${tmp_file}"' EXIT

"${render_script}" "${mode}" "${service_name}" "${project_root}" "${env_file}" "${host}" "${port}" "${data_dir}" > "${tmp_file}"

if [ "${mode}" = "user" ]; then
  plist_dir="${HOME}/Library/LaunchAgents"
  ensure_directory_exists "${plist_dir}"
  plist_path="${plist_dir}/${plist_name}"
  install -m 0644 "${tmp_file}" "${plist_path}"
  launchctl bootout "gui/$(id -u)/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "${plist_path}"
else
  plist_dir="/Library/LaunchDaemons"
  maybe_sudo mkdir -p "${plist_dir}"
  plist_path="${plist_dir}/${plist_name}"
  maybe_sudo install -m 0644 "${tmp_file}" "${plist_path}"
  maybe_sudo launchctl bootout "system/${label}" 2>/dev/null || true
  maybe_sudo launchctl bootstrap system "${plist_path}"
fi

printf 'Installed %s (%s mode)\n' "${plist_name}" "${mode}"
