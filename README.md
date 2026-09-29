# 扫码还车

用户把车停进指定区域，扫描地面二维码锁车。服务端同时校验围栏和二维码，通过后才结束订单。当前交付的是微信小程序；H5 用来在浏览器里调试扫码和地图。

业务规则见 [docs/技术方案.md](docs/技术方案.md)，接口和表结构见 [docs/后端技术方案.md](docs/后端技术方案.md)，页面和本地运行细节见 [docs/前端说明.md](docs/前端说明.md)。

## 现状

| 部分 | 状态 |
| --- | --- |
| 微信小程序 / H5 页面 | 可运行。开锁、还车、附近车辆和订单请求 api |
| HTTP 接口 | 可运行。登录、附近查询、开锁、还车、行程点和轨迹 |
| PostgreSQL、Redis、RabbitMQ、EMQX | 由 Docker Compose 启动 |

## 目录

```text
web/                  uni-app 客户端
api/                  HTTP 接口、Prisma、车锁模拟器
docs/技术方案.md       业务规则和技术选型
docs/后端技术方案.md   表结构、接口和消息
docs/前端说明.md       页面、平台差异和本地运行
docs/qr/              演示用车身码、地面码图片
docker-compose.yml    PostgreSQL、Redis、RabbitMQ、EMQX
```

## 客户端

在 `web/` 安装依赖后：

```bash
npm run dev:h5
npm run dev:mp-weixin
npm run build:mp-weixin
```

- H5 开发服务默认是 `https://localhost:5173/`。证书在 `web/.cert/`，由开发服务生成，不提交。
- 小程序产物在 `web/dist/dev/mp-weixin`，用微信开发者工具打开。上传前在 `web/src/manifest.json` 填写 AppID。
- H5 地图需要高德 Key。复制 `web/.env.example` 为 `web/.env.development`，填入 `VITE_AMAP_KEY`。这个文件不提交。

演示车辆 `BK8K2M`、`BK2P9L`、`BK7Q1C`，还车点 `PK3N7Q`。二维码图片在 `docs/qr/`。

## 数据库

需要 Docker。复制 `.env.example` 为 `api/.env`，填入口令，并让 `DATABASE_URL` 使用同一口令。`api/.env` 不提交。

```bash
docker compose up -d
cd api
npm install
npx prisma migrate deploy
npx prisma db seed
```

种子按 `api/.env` 里的 `SEED_ANCHOR_LAT`、`SEED_ANCHOR_LNG`（GCJ-02）放置车辆和停车点，编号与前端演示数据一致。重复执行不会多插开发用户；骑行中的车辆不会被改回空闲。

改表结构时在 `api/` 执行 `npx prisma migrate dev`。

## 接口

先启动中间件，再在 `api/` 启动服务和车锁模拟器：

```bash
docker compose up -d
cd api
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
npm run simulate
```

`npm run dev` 监听 `3000`，内网回调在 `3001`。H5 调试登录用 `POST /auth/dev`。演示开锁编号 `BK8K2M`，还车点 `PK3N7Q`。字段和错误码见 [docs/后端技术方案.md](docs/后端技术方案.md)。
