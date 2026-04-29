#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

action="$1"
mode="$2"
service_name="$3"
lines="${4:-100}"
unit_name="${service_name}.service"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

run_user_service() {
  case "${action}" in
    restart)
      systemctl --user restart "${unit_name}"
      ;;
    status)
      systemctl --user status "${unit_name}"
      ;;
    logs)
      journalctl --user -u "${unit_name}" -n "${lines}" --no-pager
      ;;
    follow)
      journalctl --user -u "${unit_name}" -f
      ;;
    *)
      printf 'Unsupported action: %s\n' "${action}" >&2
      exit 1
      ;;
  esac
}

run_system_service() {
  case "${action}" in
    restart)
      maybe_sudo systemctl restart "${unit_name}"
      ;;
    status)
      maybe_sudo systemctl status "${unit_name}"
      ;;
    logs)
      maybe_sudo journalctl -u "${unit_name}" -n "${lines}" --no-pager
      ;;
    follow)
      maybe_sudo journalctl -u "${unit_name}" -f
      ;;
    *)
      printf 'Unsupported action: %s\n' "${action}" >&2
      exit 1
      ;;
  esac
}

if [ "${mode}" = "user" ]; then
  run_user_service
else
  run_system_service
fi
