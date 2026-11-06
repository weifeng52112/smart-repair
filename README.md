# 智能报修小助手（smart-repair）

两人一队协同开发的实训项目：同事在网页上填一张报修单，系统自动调用 AI 生成 3 条自助排查建议，工单存进数据库，列表页可看全部单子与处理状态。

技术栈：**Next.js 14（App Router）+ Tailwind CSS + Supabase + DeepSeek**，部署到 **Vercel**。

## 1. 五分钟跑起来（不需要任何密钥）

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。此时数据走浏览器 `localStorage`，AI 建议走接口里的本地规则兜底——整条链路（填表 → 生成建议 → 入库 → 列表 → 详情 → 改状态）都能完整演示。

页面右下角会显示当前数据来源：`浏览器本地存储` 或 `Supabase 数据库`，一眼看出接没接上。

## 2. 接 Supabase（小B 的活）

1. 登录 [supabase.com](https://supabase.com) → New project，区域选 **Singapore**，记下数据库密码。
2. 左侧 **SQL Editor → New query**，把 [`supabase/schema.sql`](supabase/schema.sql) 整段粘贴执行。
3. **Project Settings → API**，抄下 `Project URL` 和 `anon public key`。
4. 项目根目录建 `.env.local`（可从 `.env.example` 复制）：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon key
DEEPSEEK_API_KEY=你的 DeepSeek 钥匙
```

5. 重启 `npm run dev`，提交一单，去 Table Editor 刷新 `tickets` 表——多出一行就说明接通了。

表结构（`supabase/schema.sql`）：`id / name / area / device / description / status / suggestions(jsonb) / created_at`，并对 `area`、`device`、`status` 做了取值约束。

## 3. 接 DeepSeek（AI 建议）

1. [platform.deepseek.com](https://platform.deepseek.com) 注册 → 实名 → API keys → 新建钥匙。
2. 写进 `.env.local` 的 `DEEPSEEK_API_KEY`（**注意变量名要和代码一致**，这是本课第二大坑）。
3. 重启后提交一单，建议区会从"本地规则兜底"变成"DeepSeek 生成"。

> 接口对 AI 失败是**兜底**而不是报错：拿不到密钥、超时、返回空，都会退回本地规则建议，并把原因写进服务端日志。页面永远有东西可展示。

## 4. 接口契约（动手前必须先定死的唯一一件事）

```
POST /api/suggest
请求体：{ "deviceType": "打印机", "description": "一直卡纸" }

200 返回：{
  "suggestions": ["建议1", "建议2", "建议3"],
  "source": "ai" | "fallback",
  "note"?: "失败原因，便于排错"
}
```

参数名和返回字段名都定死，前端只读 `suggestions`。小A 的页面是"电器"，小B 的接口是"插座"，形状对得上就通，谁都不用读懂对方全部代码。

接口实现要点（`app/api/suggest/route.ts`）：

- Key 只从 `process.env.DEEPSEEK_API_KEY` 读，永不出现在前端；
- 要求模型输出 JSON（`response_format: json_object`），服务端再清洗、截断到 3 条；
- 25 秒超时，避免页面一直转圈；
- 失败统一返回 `source: "fallback"`，业务不中断。

## 5. 目录结构

```
smart-repair/
├── app/
│   ├── layout.tsx              全局框架 + 顶部导航
│   ├── page.tsx                首页：报修表单（小A）
│   ├── tickets/page.tsx        工单列表：筛选 + 状态流转（小A）
│   ├── tickets/[id]/page.tsx   工单详情：信息 + AI 建议（小A）
│   └── api/suggest/route.ts    AI 建议接口（小B）
├── components/PageHeader.tsx   顶部导航（小A）
├── lib/
│   ├── types.ts                类型与状态流转规则（共用）
│   ├── supabase.ts             Supabase 客户端（小B）
│   ├── store.ts                数据读写，自动在 Supabase / localStorage 间切换（小B）
│   └── suggest-fallback.ts     本地规则兜底建议（小B）
├── supabase/schema.sql         建表 SQL（小B）
├── docs/screenshots/           四个页面的实际截图
└── .env.example                环境变量清单（不含真实密钥）
```

两人分工按文件划清：`app/page.tsx`、`app/tickets/**`、`components/**` 归小A；`lib/**`、`app/api/**`、`supabase/**` 归小B。**只有 `lib/types.ts` 是共用的**，改它之前先在群里说一声。

## 6. 协同开发流程（照着做就是满分）

```bash
# 两人都先同步主线
git pull origin main

# 各自从 main 切分支干活（分支名带自己名字，别撞车）
git checkout -b feature-xiaoa-form
git add .
git commit -m "表单页：提交后调用 /api/suggest 并展示建议"
git push origin feature-xiaoa-form
```

然后在 GitHub 网页上点 **Compare & pull request**，写清"改了什么、怎么验证"，等对方在 **Files changed** 里看过后点 **Merge pull request**。

建议的两次 PR 划分（正好凑够验收要求的两条分支 + 两个已合并 PR）：

| PR | 谁发 | 内容 |
| --- | --- | --- |
| #1 | 小B | Supabase 接入：建表 SQL、`lib/store.ts`、`.env.example` |
| #2 | 小A | AI 建议渲染 + 列表状态流转 + 详情页 |

仓库 Settings → Branches 给 `main` 加规则：Require a pull request before merging。

## 7. 部署上线（小A 的活）

1. vercel.com 用 GitHub 登录 → Add New → Project → 导入 `smart-repair`，框架自动识别 Next.js → Deploy。
2. **最容易翻车的一步**：`.env.local` 没上 GitHub，所以 Vercel 那边是空的。去 Settings → Environment Variables，把三行变量**一字不差**地加进去（两个 Supabase + 一个 DeepSeek）。
3. Deployments → 最新一条 ⋯ → Redeploy。
4. Settings → Domains 绑自己的域名，按提示加 CNAME，几分钟生效。

## 8. 四个故障剧本的埋雷位置

| 剧本 | 怎么埋 | 现象 | 去哪儿看 |
| --- | --- | --- | --- |
| 一、页面白屏 | 把 `components/PageHeader.tsx` 重命名成 `pageheader.tsx`（或用小写 import） | 首页空白 | F12 → Console：`Module not found` |
| 二、接口 404 | 把 `app/page.tsx` 里 `fetch("/api/suggest")` 改成 `/api/suggestion` | 提交后没建议 | F12 → Network：红色那条的 Request URL |
| 三、AI 报 500 | Vercel 上把 `DEEPSEEK_API_KEY` 改错再 Redeploy | 页面能开，提交后无建议/报错 | Vercel → Runtime Logs：`401` / `API key not valid` |
| 四、部署失败 | 把 `package.json` 里 `"react"` 的版本号写错 | Vercel 部署直接变红 | Deployments → Build Logs 最后几行 |

> 本项目对剧本二、三做了**降级处理**：接口挂了会走兜底建议，页面不会白屏。所以排查时要看 Network 里那条请求的状态码、以及建议区显示的"本地规则兜底"字样，再结合日志判断根因——这比"页面没崩"更能体现你真的会看日志。

## 9. 验收自查

- [ ] 首页能提交，姓名/办公区/设备/描述四项都进库
- [ ] 提交后立刻能看到 3 条建议（AI 或兜底均可，来源有标注）
- [ ] 列表页能看到全部工单，能筛选，能推进状态
- [ ] 详情页信息完整，能重新生成建议
- [ ] `.env.local` 没有出现在 GitHub 上（`git ls-files | grep env` 应为空）
- [ ] 至少两条分支、两个已合并的 PR
- [ ] 线上域名能在手机流量下打开并走完全流程

---

后端接口、数据层、兜底逻辑和 SQL 都已完整可运行，前端页面也已在真实浏览器里逐页验证（截图见 `docs/screenshots/`）。
