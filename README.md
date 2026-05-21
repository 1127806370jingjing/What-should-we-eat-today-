# 今天吃什么 / What Should We Eat Today

一个部署到 Cloudflare Pages 的轻量网页：用户授权定位后，后端通过高德 Web 服务 API 查询附近真实餐饮店，再帮你随机推荐“今天吃什么”。

This is a lightweight Cloudflare Pages app. After the user grants location permission, a Pages Function calls Amap Web Service APIs to find real nearby restaurants and randomly recommends one place to eat today.

## 功能特性

- 一键获取当前位置附近的餐饮店。
- 默认搜索半径为 `1.5km`。
- 使用高德坐标转换接口，减少浏览器定位坐标与高德 POI 坐标之间的偏移。
- 使用高德 POI 周边搜索接口，按餐饮类型 `050000` 查询真实店铺。
- 高德 API key 只保存在 Cloudflare Pages 环境变量中，不会写入前端代码。
- 支持“再摇一次”，在同一批附近店铺里重新推荐。
- 对定位拒绝、接口未部署、空结果、后端错误都有友好提示。

## Features

- Finds nearby restaurants from the user's current location.
- Uses a default search radius of `1.5km`.
- Converts browser GPS coordinates to Amap coordinates before POI search.
- Uses Amap POI around search with food category `050000`.
- Keeps the Amap API key on the Cloudflare backend only.
- Supports rerolling another recommendation from the same nearby shop list.
- Handles denied location permission, missing API responses, empty results, and backend errors.

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
├── src/App.tsx                       # 页面主流程和交互状态
├── src/lib/recommend.ts              # 店铺过滤、去重、随机推荐
├── src/types.ts                      # 前后端共享类型
├── src/styles.css                    # 页面样式
├── .dev.vars.example                 # 本地环境变量示例
└── README.md
```

## 本地开发 / Local Development

安装依赖：

```bash
npm install
```

只开发前端页面：

```bash
npm run dev
```

默认地址是：

```txt
http://localhost:5173
```

如果要本地完整测试 Cloudflare Pages Function，请先创建 `.dev.vars`：

```txt
AMAP_WEB_SERVICE_KEY=你的高德Web服务Key
```

然后运行：

```bash
npm run pages:dev
```

注意：`npm run dev` 只启动 Vite 前端，不会启动 `/api/nearby-food`。如果只用 `npm run dev` 点击按钮，接口可能返回空内容或 404。本地完整测试推荐使用 `npm run pages:dev`。

Install dependencies:

```bash
npm install
```

Frontend-only development:

```bash
npm run dev
```

To test Cloudflare Pages Functions locally, create `.dev.vars` first:

```txt
AMAP_WEB_SERVICE_KEY=your-amap-web-service-key
```

Then run:

```bash
npm run pages:dev
```

## Cloudflare Pages 部署 / Deployment

在 Cloudflare Pages 创建项目，并配置：

```txt
Build command: npm run build
Output directory: dist
```

在 Cloudflare Pages 的环境变量中添加：

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

Add this environment variable in Cloudflare Pages:

```txt
AMAP_WEB_SERVICE_KEY=your-amap-web-service-key
```

Custom domain options:

- Use the root domain if this is the only website on that domain.
- Use a subdomain such as `eat.example.com` if the root domain is already used by another site.

## 后端接口 / Backend API

前端请求自己的后端接口：

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
  ]
}
```

The frontend calls its own backend endpoint:

```txt
POST /api/nearby-food
```

The Pages Function then calls Amap coordinate conversion and POI around search APIs. The raw Amap response is not returned directly to the browser.

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

- 店铺过滤、去重和随机推荐。
- Cloudflare Function 参数校验、缺少 key、坐标转换、POI 结果清洗。
- 前端定位成功、定位拒绝、空接口响应提示。

Current tests cover:

- Shop normalization, deduplication, and random recommendation.
- Pages Function validation, missing key handling, coordinate conversion, and POI normalization.
- Frontend success flow, denied geolocation, and empty API response handling.

## 安全说明 / Security Notes

- 不要把真实高德 API key 写入源码。
- 不要提交 `.dev.vars` 或任何本地环境变量文件。
- 高德 key 已经在聊天或本地环境中出现过时，正式部署前建议换新 key。
- 在高德控制台为 key 设置合适的服务限制。
- 部署后可以打开浏览器 Network 面板确认前端只请求 `/api/nearby-food`，不会直接请求高德接口，也不会暴露 key。

- Do not hard-code the real Amap API key in source files.
- Do not commit `.dev.vars` or any local environment variable files.
- Rotate the Amap key before production if it has ever been pasted into chat or local files.
- Configure reasonable service restrictions in the Amap console.
- After deployment, check the browser Network panel. The frontend should only call `/api/nearby-food`; it should not expose the Amap key.

## 常见问题 / Troubleshooting

### Failed to execute 'json' on 'Response': Unexpected end of JSON input

通常是本地只运行了 `npm run dev`，导致 `/api/nearby-food` 没有被 Cloudflare Pages Function 接管。请使用：

```bash
npm run pages:dev
```

This usually means the frontend is running without the Pages Function. Use:

```bash
npm run pages:dev
```

### 页面提示没有配置高德 API key

请确认 Cloudflare Pages 的 Production 环境变量中设置了：

```txt
AMAP_WEB_SERVICE_KEY
```

If the page says the Amap key is missing, make sure `AMAP_WEB_SERVICE_KEY` is configured in the Cloudflare Pages production environment.

## License

MIT
