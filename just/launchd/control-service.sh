#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "${script_dir}/common.sh"

action="$1"
mode="$2"
service_name="$3"
lines="${4:-100}"

if [ "${mode}" != "system" ] && [ "${mode}" != "user" ]; then
  printf 'Invalid mode: %s\n' "${mode}" >&2
  exit 1
fi

label="cn.actrue.prompt.${service_name}"

if [ "${mode}" = "system" ]; then
  stdout_log="/var/log/${service_name}.out.log"
  stderr_log="/var/log/${service_name}.err.log"
else
  stdout_log="${HOME}/Library/Logs/${service_name}.out.log"
  stderr_log="${HOME}/Library/Logs/${service_name}.err.log"
fi

run_user_service() {
  local target="gui/$(id -u)/${label}"
  local domain="gui/$(id -u)"

  case "${action}" in
    restart)
      launchctl kickstart -k "${target}"
      ;;
    status)
      launchctl list | grep "${label}" || printf 'Service %s not found\n' "${label}" >&2
      ;;
    logs)
      if [ -f "${stdout_log}" ]; then
        tail -n "${lines}" "${stdout_log}"
      else
        printf 'Log file not found: %s\n' "${stdout_log}" >&2
      fi
      ;;
    follow)
      if [ -f "${stdout_log}" ]; then
        tail -f "${stdout_log}"
      else
        printf 'Log file not found: %s\n' "${stdout_log}" >&2
        exit 1
      fi
      ;;
    *)
      printf 'Unsupported action: %s\n' "${action}" >&2
      exit 1
      ;;
  esac
}

run_system_service() {
  local target="system/${label}"

  case "${action}" in
    restart)
      maybe_sudo launchctl kickstart -k "${target}"
      ;;
    status)
      maybe_sudo launchctl list | grep "${label}" || printf 'Service %s not found\n' "${label}" >&2
      ;;
    logs)
      if [ -f "${stdout_log}" ]; then
        tail -n "${lines}" "${stdout_log}"
      else
        printf 'Log file not found: %s\n' "${stdout_log}" >&2
      fi
      ;;
    follow)
      if [ -f "${stdout_log}" ]; then
        tail -f "${stdout_log}"
      else
        printf 'Log file not found: %s\n' "${stdout_log}" >&2
        exit 1
      fi
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
