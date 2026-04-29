# just 命令说明

## 目录约定

- 根目录的 `justfile` 只负责作为入口。
- 真正的 recipes 在 `just/main.just`。
- `systemd` 部署辅助脚本都在 `just/systemd/`。

这样做的目的是把入口保持稳定，同时把实现细节都收敛到 `just/` 目录，方便后续维护。

## 常用命令

```bash
just
just help
just install
just dev
just lint
just test
just build
just standalone-build
just standalone-start
```

### 命令用途

- `just` / `just help`
  - 查看命令列表。
- `just install`
  - 执行 `pnpm install --frozen-lockfile`。
- `just dev`
  - 以开发模式启动，默认监听 `127.0.0.1:3001`。
- `just lint`
  - 运行 ESLint。
- `just test`
  - 运行 Vitest。
- `just build`
  - 运行标准 `next build`。
- `just standalone-build`
  - 先执行依赖安装和生产构建，再把 `public` 与 `.next/static` 同步到 `.next/standalone/`，得到可直接运行的 standalone 产物。
- `just standalone-start`
  - 从仓库根目录直接运行 `.next/standalone/server.js`，适合在安装 `systemd` 前本机预演。

## 参数默认值

以下命令都支持按顺序覆盖参数：

```bash
just dev [host] [port]
just standalone-start [env_file] [host] [port] [data_dir]
just systemd-print [service] [env_file] [host] [port] [data_dir]
just systemd-install [service] [env_file] [host] [port] [data_dir]
just systemd-deploy [service] [env_file] [host] [port] [data_dir]
```

默认值如下：

- `service`: `aicontext`
- `env_file`: `.env`
- `host`: `127.0.0.1`
- `dev port`: `3001`
- `prod port`: `43000`
- `data_dir`: `data`

示例：

```bash
just dev 0.0.0.0 3001
just standalone-start .env 127.0.0.1 43000 data
just systemd-deploy aicontext .env 127.0.0.1 43000 data
```

## systemd 部署

### 推荐的一键部署

```bash
just systemd-deploy
```

这条命令会做两件事：

1. 构建 standalone 产物
2. 安装并启动 `systemd` 服务

默认会安装为系统服务，也就是写入 `/etc/systemd/system/aicontext.service`。如果你不想使用系统服务，可以改成用户服务：

```bash
just systemd-deploy-user
```

### 查看将要写入的 unit 文件

```bash
just systemd-print
just systemd-print-user
```

### 常用 systemd 运维命令

```bash
just systemd-status
just systemd-restart
just systemd-logs
just systemd-follow
just systemd-uninstall
```

用户服务对应命令：

```bash
just systemd-status-user
just systemd-restart-user
just systemd-logs-user
just systemd-follow-user
just systemd-uninstall-user
```

## 部署设计说明

### 1. 路径可移植

- 所有路径都在执行时解析成绝对路径，不依赖你从哪个目录运行 `just`。
- `systemd` unit 里会把 `WorkingDirectory` 固定到当前仓库根目录。
- `ExecStart` 会记录当前机器上 `node` 的绝对路径，避免 `systemd` 环境里拿不到交互式 shell 的 `PATH`。

如果你后来升级了 Node，或者切换了另一套 Node 安装路径，重新执行一次 `just systemd-install` 或 `just systemd-deploy` 即可。

### 2. 数据目录可移植

项目当前 `.env.example` 里的 `DATA_DIR=/app/data` 是 Docker 场景的默认值，不适合直接照搬到本机。

因此这些 `systemd` 脚本会显式覆盖：

- `DATA_DIR`
- `PROMPT_ASSET_DB_PATH`

默认会把数据写到仓库根目录下的 `data/`，也就是：

```text
data/
data/app.db
```

如果你想改到别的位置：

```bash
just systemd-deploy aicontext .env 127.0.0.1 43000 /srv/aicontext-data
```

### 3. 默认监听地址

生产默认监听 `127.0.0.1:43000`，这更适合放在 nginx / Caddy 之类的反向代理后面。

如果你确实要直接暴露服务，可以显式改成：

```bash
just systemd-deploy aicontext .env 0.0.0.0 43000 data
```

## 用户服务补充说明

如果你选择 `--user` 这一套服务，并且希望它在退出登录后仍然随系统运行，需要为当前用户启用 linger：

```bash
sudo loginctl enable-linger "$(id -un)"
```

## 建议流程

首次部署建议按这个顺序：

```bash
cp .env.example .env
just standalone-build
just standalone-start
just systemd-deploy
just systemd-status
```

如果你已经确认 `.env` 没问题，也可以直接执行：

```bash
just systemd-deploy
```
