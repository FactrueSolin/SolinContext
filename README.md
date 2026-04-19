# AI Context

## Local Development

```bash
pnpm install
pnpm dev
```

本地开发如果需要覆盖根目录 `.env`，请新建 `.env.development.local`。
Next.js 在 `pnpm dev` 下会优先读取 `.env.development.local` / `.env.local`，所以你可以把线上 `.env` 保留给 Docker，开发环境单独维护。

可以直接从以下模板复制：

```bash
cp .env.development.local.example .env.development.local
```

默认会把应用数据写入 `./data`。项目与提示词资产都会存入同一个 SQLite 数据库 `app.db`。

## Docker Deployment

### docker compose

```bash
docker compose up -d --build
```

`docker-compose.yml` 运行时固定读取仓库根目录 `.env` 作为正式部署配置。
为了避免本地 `.env.local` / `.env.development.local` 污染生产镜像构建，Docker 构建上下文会忽略所有 `.env*` 文件。

默认会使用 Docker/BuildKit 的常规构建缓存。

默认会创建一个名为 `aicontext-data` 的 Docker volume，并挂载到容器内的 `/app/data`。应用数据库和运行时数据都会持久化到这个 volume 中。

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
  --env-file .env \
  -p 3000:3000 \
  -v aicontext-data:/app/data \
  aicontext
```

如果希望在手动 `docker build` 时额外把缓存持久化到项目根目录下的 `.docker-cache/`，建议使用 `docker buildx build`：

```bash
docker buildx build \
  --cache-from type=local,src=.docker-cache \
  --cache-to type=local,dest=.docker-cache,mode=max \
  -t aicontext .
```

## Runtime Data Paths

- `DATA_DIR`：运行时数据目录，默认是 `/app/data`（Docker）或 `./data`（本地）。
- `PROMPT_ASSET_DB_PATH`：应用 SQLite 数据库文件路径，默认是 `${DATA_DIR}/app.db`。

如果 `DATA_DIR` 下仍然存在旧版 `data/<projectId>/project.json` 与 `history/*.json`，服务首次访问项目数据时会自动导入到 SQLite。

如果你需要把数据直接写到宿主机目录，也可以把 volume 改成 bind mount，例如：

```yaml
services:
  app:
    volumes:
      - ./data:/app/data
```
