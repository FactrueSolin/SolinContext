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

label="cn.actrue.prompt.${service_name}"

if [ "${mode}" = "system" ]; then
  stdout_log="/var/log/${service_name}.out.log"
  stderr_log="/var/log/${service_name}.err.log"
else
  stdout_log="${HOME}/Library/Logs/${service_name}.out.log"
  stderr_log="${HOME}/Library/Logs/${service_name}.err.log"
fi

label_escaped="$(plist_escape "${label}")"
node_bin_escaped="$(plist_escape "${node_bin}")"
server_js_escaped="$(plist_escape "${server_js}")"
project_root_escaped="$(plist_escape "${project_root}")"
stdout_log_escaped="$(plist_escape "${stdout_log}")"
stderr_log_escaped="$(plist_escape "${stderr_log}")"

cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label_escaped}</string>
    <key>WorkingDirectory</key>
    <string>${project_root_escaped}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${node_bin_escaped}</string>
        <string>${server_js_escaped}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>HOSTNAME</key>
        <string>$(plist_escape "${host}")</string>
        <key>PORT</key>
        <string>$(plist_escape "${port}")</string>
        <key>DATA_DIR</key>
        <string>$(plist_escape "${data_dir}")</string>
        <key>PROMPT_ASSET_DB_PATH</key>
        <string>$(plist_escape "${db_path}")</string>
        <key>NODE_OPTIONS</key>
        <string>--enable-source-maps</string>
EOF

while IFS= read -r line || [ -n "${line}" ]; do
  line="$(printf '%s' "${line}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "${line}" ] && continue
  [[ "${line}" == \#* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  if [ -n "${key}" ] && [ -n "${value}" ]; then
    printf '        <key>%s</key>\n' "$(plist_escape "${key}")"
    printf '        <string>%s</string>\n' "$(plist_escape "${value}")"
  fi
done < "${env_file}"

cat <<EOF
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${stdout_log_escaped}</string>
    <key>StandardErrorPath</key>
    <string>${stderr_log_escaped}</string>
</dict>
</plist>
EOF
