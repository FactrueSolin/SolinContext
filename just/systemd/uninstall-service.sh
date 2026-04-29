#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

mode="$1"
service_name="$2"
unit_name="${service_name}.service"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

require_command systemctl

if [ "${mode}" = "user" ]; then
  unit_path="${HOME}/.config/systemd/user/${unit_name}"
  systemctl --user disable --now "${unit_name}" >/dev/null 2>&1 || true
  rm -f "${unit_path}"
  systemctl --user daemon-reload
else
  unit_path="/etc/systemd/system/${unit_name}"
  maybe_sudo systemctl disable --now "${unit_name}" >/dev/null 2>&1 || true
  maybe_sudo rm -f "${unit_path}"
  maybe_sudo systemctl daemon-reload
fi

printf 'Removed %s (%s mode)\n' "${unit_name}" "${mode}"
