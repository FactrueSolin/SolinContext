#!/usr/bin/env bash
set -euo pipefail

get_project_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${script_dir}/../.." && pwd
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${command_name}" >&2
    exit 1
  fi
}

resolve_path() {
  local raw_path="$1"
  local base_dir="$2"

  case "${raw_path}" in
    "~")
      printf '%s\n' "${HOME}"
      ;;
    "~/"*)
      printf '%s\n' "${HOME}/${raw_path#~/}"
      ;;
    /*)
      printf '%s\n' "${raw_path}"
      ;;
    *)
      (
        cd "${base_dir}"
        cd "$(dirname "${raw_path}")"
        printf '%s/%s\n' "$(pwd)" "$(basename "${raw_path}")"
      )
      ;;
  esac
}

ensure_file_exists() {
  local file_path="$1"
  if [ ! -f "${file_path}" ]; then
    printf 'Required file not found: %s\n' "${file_path}" >&2
    exit 1
  fi
}

ensure_directory_exists() {
  local directory_path="$1"
  mkdir -p "${directory_path}"
}

maybe_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  printf 'This action requires root privileges or sudo: %s\n' "$*" >&2
  exit 1
}

systemd_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "${value}"
}
