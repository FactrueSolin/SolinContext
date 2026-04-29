#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
# Shared helpers keep path resolution consistent across all systemd scripts.
source "${script_dir}/common.sh"

project_root="${1:-$(get_project_root)}"

require_command pnpm

cd "${project_root}"

pnpm install --frozen-lockfile
pnpm build

if [ ! -f ".next/standalone/server.js" ]; then
  printf 'Standalone output was not generated at %s\n' "${project_root}/.next/standalone/server.js" >&2
  exit 1
fi

mkdir -p .next/standalone/.next

rm -rf .next/standalone/public .next/standalone/.next/static

if [ -d public ]; then
  cp -R public .next/standalone/public
fi

if [ -d .next/static ]; then
  cp -R .next/static .next/standalone/.next/static
fi

printf 'Standalone build is ready at %s\n' "${project_root}/.next/standalone"
