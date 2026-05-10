#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

mode="$1"
service_name="$2"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

require_command launchctl

label="cn.actrue.prompt.${service_name}"
plist_name="${label}.plist"

if [ "${mode}" = "user" ]; then
  plist_path="${HOME}/Library/LaunchAgents/${plist_name}"
  launchctl bootout "gui/$(id -u)/${label}" 2>/dev/null || true
  rm -f "${plist_path}"
else
  plist_path="/Library/LaunchDaemons/${plist_name}"
  maybe_sudo launchctl bootout "system/${label}" 2>/dev/null || true
  maybe_sudo rm -f "${plist_path}"
fi

printf 'Removed %s (%s mode)\n' "${plist_name}" "${mode}"
