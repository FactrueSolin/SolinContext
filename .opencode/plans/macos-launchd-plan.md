# macOS Launchd 服务注册计划

## 概述

在 `just/launchd/` 目录下创建与 `just/systemd/` 平行的脚本集，使用 macOS `launchd` 替代 `systemd`，并在 `just/main.just` 中添加对应的 `launchd-*` recipes。

## 对应关系

| systemd | macOS launchd |
|---|---|
| `.service` 文件 | `.plist` 文件 (XML) |
| `systemctl` | `launchctl` |
| `/etc/systemd/system/` (system) | `/Library/LaunchDaemons/` (system) |
| `~/.config/systemd/user/` (user) | `~/Library/LaunchAgents/` (user) |
| `journalctl` | `log show` / 日志文件 |
| `daemon-reload` | `kickstart` / unload + load |

## 新建文件

### 1. `just/launchd/common.sh`

共享工具函数，复用 systemd 的 `common.sh` 模式：
- `get_project_root()` — 解析项目根目录
- `require_command()` — 检查必需命令
- `resolve_path()` — 路径解析（支持 `~`、相对、绝对）
- `ensure_file_exists()` / `ensure_directory_exists()` — 前置校验
- `maybe_sudo()` — 需要 root 时自动 sudo
- `plist_escape()` — XML 特殊字符转义（替代 `systemd_quote()`）

### 2. `just/launchd/render-plist.sh`

生成 `.plist` 文件内容。参数与 `render-unit.sh` 一致：
```
render-plist.sh <mode> <service_name> <project_root> <env_file> <host> <port> <data_dir>
```

mode: `system` (LaunchDaemon) 或 `user` (LaunchAgent)

生成的 plist 结构：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>cn.actrue.prompt.{service_name}</string>
    <key>WorkingDirectory</key>
    <string>{project_root}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{node_bin}</string>
        <string>{project_root}/.next/standalone/server.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>HOSTNAME</key>
        <string>{host}</string>
        <key>PORT</key>
        <string>{port}</string>
        <key>DATA_DIR</key>
        <string>{data_dir}</string>
        <key>PROMPT_ASSET_DB_PATH</key>
        <string>{data_dir}/app.db</string>
        <key>NODE_OPTIONS</key>
        <string>--enable-source-maps</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/{service_name}.out.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/{service_name}.err.log</string>
</dict>
</plist>
```

注意：
- system 模式日志路径用 `/var/log/`，user 模式用 `~/Library/Logs/`
- launchd 不支持 `EnvironmentFile`，需要在脚本中读取 `.env` 文件并注入到 plist 的 `EnvironmentVariables` 中
- label 使用反向域名格式 `cn.actrue.prompt.{service_name}`

### 3. `just/launchd/install-service.sh`

安装服务。参数与 systemd 版本一致：
```
install-service.sh <mode> <service_name> <project_root> <env_file> <host> <port> <data_dir>
```

流程：
1. 调用 `render-plist.sh` 生成 plist 到临时文件
2. 复制到目标目录：
   - system: `/Library/LaunchDaemons/{label}.plist` (需要 sudo)
   - user: `~/Library/LaunchAgents/{label}.plist`
3. 加载服务：`launchctl bootstrap gui/$(id -u) <path>` (user) 或 `launchctl bootstrap system <path>` (system)

### 4. `just/launchd/control-service.sh`

服务控制。支持 actions: `restart`, `status`, `logs`, `follow`

| action | system 命令 | user 命令 |
|---|---|---|
| restart | `launchctl kickstart -k system/<label>` | `launchctl kickstart -k gui/$(id -u)/<label>` |
| status | `launchctl list \| grep <label>` | 同上 |
| logs | `tail -n {lines} /var/log/{service_name}.out.log` | `tail -n {lines} ~/Library/Logs/{service_name}.out.log` |
| follow | `tail -f /var/log/{service_name}.out.log` | `tail -f ~/Library/Logs/{service_name}.out.log` |

### 5. `just/launchd/uninstall-service.sh`

卸载服务：
1. `launchctl bootout ...` 停止服务
2. 删除 plist 文件
3. 打印确认信息

## Justfile 新增 recipes

在 `just/main.just` 中添加，与 systemd recipes 平行：

| Recipe | 描述 |
|---|---|
| `launchd-print` | 打印生成的 plist 到 stdout |
| `launchd-print-user` | 打印 user 模式的 plist |
| `launchd-install` | 安装为 LaunchDaemon (system) |
| `launchd-install-user` | 安装为 LaunchAgent (user) |
| `launchd-deploy` | build + install (system) |
| `launchd-deploy-user` | build + install (user) |
| `launchd-restart` | 重启 system 服务 |
| `launchd-restart-user` | 重启 user 服务 |
| `launchd-status` | 查看 system 服务状态 |
| `launchd-status-user` | 查看 user 服务状态 |
| `launchd-logs` | 查看 system 服务日志 |
| `launchd-logs-user` | 查看 user 服务日志 |
| `launchd-follow` | 实时跟踪 system 服务日志 |
| `launchd-follow-user` | 实时跟踪 user 服务日志 |
| `launchd-uninstall` | 卸载 system 服务 |
| `launchd-uninstall-user` | 卸载 user 服务 |

所有 recipes 使用与 systemd 相同的默认参数（service_name, env_file, host, port, data_dir）。

## 实现顺序

1. 创建 `just/launchd/` 目录
2. 编写 `common.sh`
3. 编写 `render-plist.sh`
4. 编写 `install-service.sh`
5. 编写 `control-service.sh`
6. 编写 `uninstall-service.sh`
7. 在 `just/main.just` 中添加所有 recipes
8. 添加脚本可执行权限 (`chmod +x`)
9. 测试 `launchd-print` 验证 plist 生成
10. 测试 `launchd-deploy-user` 完整流程

## 注意事项

- launchd 不支持 `EnvironmentFile` 指令，`.env` 文件的内容需要在 `render-plist.sh` 中读取并逐行注入到 plist 的 `<dict>` 中
- macOS 系统完整性保护 (SIP) 不影响 `/Library/LaunchDaemons/` 和 `~/Library/LaunchAgents/`
- `launchctl bootstrap` / `bootout` 是 macOS 10.11+ 推荐的方式，替代旧的 `load` / `unload`
- 日志文件需要确保目录存在且有写入权限
