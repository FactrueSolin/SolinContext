project_root := justfile_directory()
systemd_dir := project_root + "/just/systemd"

default_service_name := "aicontext"
default_dev_host := "127.0.0.1"
default_dev_port := "3001"
default_prod_host := "127.0.0.1"
default_prod_port := "43000"
default_env_file := ".env"
default_data_dir := "data"

default:
  @just --list

help:
  @just --list

install:
  @cd "{{project_root}}" && pnpm install --frozen-lockfile

dev host=default_dev_host port=default_dev_port:
  @cd "{{project_root}}" && pnpm exec next dev --hostname "{{host}}" --port "{{port}}"

lint:
  @cd "{{project_root}}" && pnpm lint

test:
  @cd "{{project_root}}" && pnpm test

build:
  @cd "{{project_root}}" && pnpm build

standalone-build:
  @"{{systemd_dir}}/build-standalone.sh" "{{project_root}}"

standalone-start env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @cd "{{project_root}}" && bash -lc 'set -a; source "{{env_file}}"; set +a; export NODE_ENV=production HOSTNAME="{{host}}" PORT="{{port}}" DATA_DIR="{{data_dir}}" PROMPT_ASSET_DB_PATH="{{data_dir}}/app.db"; exec node .next/standalone/server.js'

systemd-print service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/render-unit.sh" system "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-print-user service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/render-unit.sh" user "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-install service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/install-service.sh" system "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-install-user service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/install-service.sh" user "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-deploy service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/build-standalone.sh" "{{project_root}}"
  @"{{systemd_dir}}/install-service.sh" system "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-deploy-user service=default_service_name env_file=default_env_file host=default_prod_host port=default_prod_port data_dir=default_data_dir:
  @"{{systemd_dir}}/build-standalone.sh" "{{project_root}}"
  @"{{systemd_dir}}/install-service.sh" user "{{service}}" "{{project_root}}" "{{env_file}}" "{{host}}" "{{port}}" "{{data_dir}}"

systemd-restart service=default_service_name: standalone-build
  @"{{systemd_dir}}/control-service.sh" restart system "{{service}}"

systemd-restart-user service=default_service_name:
  @"{{systemd_dir}}/control-service.sh" restart user "{{service}}"

systemd-status service=default_service_name:
  @"{{systemd_dir}}/control-service.sh" status system "{{service}}"

systemd-status-user service=default_service_name:
  @"{{systemd_dir}}/control-service.sh" status user "{{service}}"

systemd-logs service=default_service_name lines="100":
  @"{{systemd_dir}}/control-service.sh" logs system "{{service}}" "{{lines}}"

systemd-logs-user service=default_service_name lines="100":
  @"{{systemd_dir}}/control-service.sh" logs user "{{service}}" "{{lines}}"

systemd-follow service=default_service_name:
  @"{{systemd_dir}}/control-service.sh" follow system "{{service}}"

systemd-follow-user service=default_service_name:
  @"{{systemd_dir}}/control-service.sh" follow user "{{service}}"

systemd-uninstall service=default_service_name:
  @"{{systemd_dir}}/uninstall-service.sh" system "{{service}}"

systemd-uninstall-user service=default_service_name:
  @"{{systemd_dir}}/uninstall-service.sh" user "{{service}}"
