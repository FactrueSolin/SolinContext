# AI Context

## Local Development

```bash
pnpm install
pnpm dev
```

默认会把项目数据和提示词资产数据库写入 `./data`。

## Docker Deployment

### docker compose

```bash
docker compose up -d --build
```

默认会创建一个名为 `aicontext-data` 的 Docker volume，并挂载到容器内的 `/app/data`。项目数据和 SQLite 数据库都会持久化到这个 volume 中。

停止服务但保留数据：

```bash
docker compose down
```

如果执行 `docker compose down -v`，会同时删除持久化数据卷。

### docker run

```bash
docker build -t aicontext .
docker run -d \
  --name aicontext \
  -p 3000:3000 \
  -v aicontext-data:/app/data \
  aicontext
```

## Runtime Data Paths

- `DATA_DIR`：项目数据目录，默认是 `/app/data`（Docker）或 `./data`（本地）。
- `PROMPT_ASSET_DB_PATH`：提示词资产 SQLite 数据库文件路径，默认是 `${DATA_DIR}/app.db`。

如果你需要把数据直接写到宿主机目录，也可以把 volume 改成 bind mount，例如：

```yaml
services:
  app:
    volumes:
      - ./data:/app/data
```
