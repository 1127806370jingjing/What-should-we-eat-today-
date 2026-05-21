# 今天吃什么 / What Should We Eat Today

一个部署到 Cloudflare Pages 的“今天吃什么”网页。它可以基于当前位置查询附近真实餐饮店，也可以把附近店铺保存到自定义分组中，之后从自己的清单里抽取。

A Cloudflare Pages app that helps answer “what should we eat today”. It can recommend real nearby restaurants via Amap Web Service APIs, or draw from custom restaurant groups saved in the browser.

## 功能特性

- `随机抽取`：获取当前位置附近真实餐饮店并随机推荐。
- `自选抽取`：从附近店铺列表勾选保存到自定义分组，再从分组里抽取。
- 支持多个本地分组，例如 `清淡组`、`食肉组`，数据保存在当前浏览器 `localStorage`。
- 默认半径可选：`0.5km`、`1km`、`1.5km`、`3km`、`5km`。
- 后端自动分页拉取高德 POI，突破单页 `25` 条限制，并按 POI id 去重。
- 主按钮合并：首次为“今天吃什么 / 抽一个”，抽出结果后变为“再摇一次”。
- 原创饭碗签筒 LOGO 和 favicon。
- 高德 API key 只保存在 Cloudflare Pages 环境变量或本地 `.dev.vars`，不会进入前端代码。

## Features

- `Random Draw`: find real nearby restaurants and recommend one.
- `Custom Draw`: select nearby shops, save them into local groups, and draw from those groups.
- Multiple browser-local groups, such as `清淡组` and `食肉组`, stored in `localStorage`.
- Radius presets: `0.5km`, `1km`, `1.5km`, `3km`, `5km`.
- Backend pagination for Amap POI search, so results are no longer capped at the first `25` shops.
- One primary draw button: first draw, then reroll from the current pool.
- Original bowl-and-lottery-stick logo and favicon.
- The Amap API key stays on the backend only.

## 技术栈 / Tech Stack

- Vite
- React
- TypeScript
- Vitest
- Cloudflare Pages
- Cloudflare Pages Functions
- Amap Web Service API

## 项目结构 / Project Structure

```txt
.
├── functions/api/nearby-food.ts      # Cloudflare Pages Function，代理高德 API
├── src/App.tsx                       # 页面主流程、模式切换、抽取交互
├── src/components/Logo.tsx           # 原创 SVG LOGO
├── src/lib/customGroups.ts           # 自选分组与 localStorage 读写
├── src/lib/recommend.ts              # 店铺去重、筛选、随机推荐
├── src/types.ts                      # 前后端共享类型
├── src/styles.css                    # 页面样式
├── public/favicon.svg                # favicon
├── .dev.vars.example                 # 本地环境变量示例
└── README.md
```

## 本地开发 / Local Development

安装依赖：

```bash
npm install
```

本地完整调试 Cloudflare Pages Functions，请创建 `.dev.vars`：

```txt
AMAP_WEB_SERVICE_KEY=你的高德Web服务Key
```

然后运行：

```bash
npm run pages:dev
```

打开：

```txt
http://127.0.0.1:8788
```

注意：`npm run dev` 只启动 Vite 前端，不会启动 `/api/nearby-food`。需要测试真实附近店铺时请使用 `npm run pages:dev`。

Install dependencies:

```bash
npm install
```

For full local testing with Pages Functions, create `.dev.vars`:

```txt
AMAP_WEB_SERVICE_KEY=your-amap-web-service-key
```

Then run:

```bash
npm run pages:dev
```

Open:

```txt
http://127.0.0.1:8788
```

## Cloudflare Pages 部署 / Deployment

在 Cloudflare Pages 创建项目，并配置：

```txt
Build command: npm run build
Output directory: dist
```

在 Cloudflare Pages 的 Production 环境变量中添加：

```txt
AMAP_WEB_SERVICE_KEY=你的高德Web服务Key
```

域名绑定建议：

- 如果你的域名只给这个项目用，可以绑定根域名，例如 `example.com`。
- 如果你的域名已经有其他站点，建议绑定子域名，例如 `eat.example.com`。

Create a Cloudflare Pages project with:

```txt
Build command: npm run build
Output directory: dist
```

Add this production environment variable:

```txt
AMAP_WEB_SERVICE_KEY=your-amap-web-service-key
```

## 后端接口 / Backend API

```txt
POST /api/nearby-food
```

请求体：

```json
{
  "lat": 31.2,
  "lng": 121.5,
  "radius": 1500
}
```

响应体：

```json
{
  "shops": [
    {
      "id": "poi-id",
      "name": "店铺名称",
      "address": "店铺地址",
      "distance": 320,
      "type": "餐饮服务;中餐厅",
      "location": "121.5001,31.2002",
      "rating": "4.7",
      "cost": "28.00"
    }
  ],
  "meta": {
    "fetchedPages": 8,
    "reachedProviderLimit": true
  }
}
```

说明：

- 后端会先把浏览器 GPS 坐标转换为高德坐标。
- 高德周边搜索单页最多 `25` 条，本项目会自动翻页获取可返回结果。
- 高德同一组搜索参数存在平台分页上限，因此 `reachedProviderLimit=true` 表示已加载本次查询可返回的全部结果。

## 测试 / Testing

运行单元测试：

```bash
npm run test
```

运行生产构建：

```bash
npm run build
```

当前测试覆盖：

- 高德 API key 缺失、坐标校验、坐标转换、POI 清洗。
- 高德 POI 多页拉取、跨页去重、分页上限、QPS 节流。
- 附近店铺随机抽取、半径切换后重新查询、单按钮再摇一次。
- 自选分组新增、重命名、删除、保存附近店铺、正则筛选、localStorage 兼容。

## 安全说明 / Security Notes

- 不要把真实高德 API key 写入源码。
- 不要提交 `.dev.vars` 或任何本地环境变量文件。
- `.dev.vars*` 已在 `.gitignore` 中忽略，`.dev.vars.example` 除外。
- 高德 key 已经在聊天或本地环境中出现过时，正式部署前建议换新 key。
- 部署后可在浏览器 Network 面板确认：前端只请求 `/api/nearby-food`，不会直接请求高德接口，也不会暴露 key。

- Do not hard-code the real Amap API key.
- Do not commit `.dev.vars` or any local env files.
- `.dev.vars*` is ignored by Git, except `.dev.vars.example`.
- Rotate the Amap key before production if it has appeared in chat or local files.
- After deployment, verify the frontend only calls `/api/nearby-food`.

## 常见问题 / Troubleshooting

### 附近店铺接口没有返回有效内容

本地通常是因为只运行了 `npm run dev`。请使用：

```bash
npm run pages:dev
```

### Failed to execute 'json' on 'Response': Unexpected end of JSON input

这通常表示前端没有连到 Cloudflare Pages Function，或者接口返回了空响应。本地完整调试请使用：

```bash
npm run pages:dev
```

### 页面提示没有配置高德 API key

请确认本地 `.dev.vars` 或 Cloudflare Pages Production 环境变量中设置了：

```txt
AMAP_WEB_SERVICE_KEY
```

## License

MIT
