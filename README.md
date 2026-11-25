# EasyBuild Admin CLI

> 本仓库是 **easybuild-admin** 脚手架（npm 包）：一条命令从官方模板创建 **EasyBuild Admin** (易构) 管理后台项目，自动锁定模板的正式发布版本、替换项目信息、初始化 Git 并安装依赖。
>
> 下方的「获取项目」「可用参数」是 CLI 用法；「技术栈」「核心架构」「开发规范」等章节描述的是脚手架生成出来的模板项目本身。

- CLI 源码仓库：[https://github.com/easybuild-jack/eba-cli](https://github.com/easybuild-jack/eba-cli)
- 使用手册：[docs/前端脚手架使用手册.md](https://github.com/easybuild-jack/eba-cli/blob/main/docs/%E5%89%8D%E7%AB%AF%E8%84%9A%E6%89%8B%E6%9E%B6%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C.md)
- 模板仓库：[https://github.com/easybuild-jack/easybuild-admin-front](https://github.com/easybuild-jack/easybuild-admin-front)
- npm 包：[https://www.npmjs.com/package/easybuild-admin](https://www.npmjs.com/package/easybuild-admin)

---

## 获取项目

> 环境要求：**Node.js >= 18.17.0**

### 方式一：使用 CLI 命令创建（推荐）

一行命令即可创建项目，自动完成模板下载、项目信息替换、Git 初始化和依赖安装：

```bash
npx easybuild-admin my-project
```

按提示依次输入项目描述、选择包管理器即可完成创建。

也可以通过参数跳过交互，直接创建：

```bash
npx easybuild-admin my-project -d "我的管理后台" --pm yarn
```

**常用命令参考：**

```bash
# 交互式创建（逐步引导）
npx easybuild-admin

# 指定项目名 + 描述 + 包管理器
npx easybuild-admin my-project -d "项目描述" --pm pnpm

# 只下载模板，不初始化 git 也不安装依赖
npx easybuild-admin my-project --skip-git --skip-install

# 非交互执行（CI）：参数 + -y，全程不弹任何问题
npx easybuild-admin my-project -d "项目描述" --pm yarn --skip-install -y
```

**可用参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `[project-name]` | 项目名称 | 交互输入 |
| `-d, --description <desc>` | 项目描述 | 交互输入 |
| `--pm <pm>` | 包管理器：`yarn` / `pnpm` / `npm`，传其他值直接报错 | 交互选择 |
| `--skip-install` | 跳过依赖安装 | `false` |
| `--skip-git` | 跳过 Git 初始化 | `false` |
| `-y, --yes` | 全部使用默认值，不进行任何交互（用于 CI） | `false` |
| `--json` | 输出一行机器可读 JSON（stdout 仅一行、隐含非交互，适合 AI Agent） | `false` |
| `--repo <repo>` | 自定义模板仓库，可用 `#分支或tag` 指定版本 | `easybuild-jack/easybuild-admin-front` |

> **交互与 CI**：命令行已给出的参数不会再提问；加 `-y` 会全部使用默认值（默认初始化 Git 并安装依赖，可用 `--skip-git` / `--skip-install` 关闭）。若 stdin 不是 TTY 且仍有问题需要交互，CLI 会直接报错并提示补齐参数，而不是卡住或崩溃。

> **AI Agent / 自动化**：加 `--json` 后 stdout 只输出一行 JSON（`ok`、`project.path`、`template`、`git`、`dependencies`、`durationMs`，失败时 `error.code`），进度与提示全部静默；`--json` 隐含非交互，需配合 `-y` 或参数齐全。完整契约、错误码与提示词模板见 [使用手册第 10 节](./docs/前端脚手架使用手册.md#10-ai-agent-调用指南)。

> **默认拉取最新发布版**：CLI 会先解析模板仓库的最新正式 Release tag（不含 pre-release / draft），再按该 tag 下载模板，保证脚手架产出的项目来自经过发布的稳定代码。若解析失败（离线或网络受限），会提示并使用仓库默认分支。需要某个具体版本或分支时，用 `--repo owner/repo#v1.0.0` 覆盖。

> **常见提示的含义**：
> - `未能获取最新发布版本，将使用仓库默认分支`：离线或 GitHub 不可达，仍会继续下载默认分支；
> - `找不到模板的默认分支` / `找不到模板版本 "xxx"`：仓库地址写错、仓库为私有，或 `--repo` 里的分支 / tag 不存在；
> - `模板中缺少 package.json`：`--repo` 指向的不是本模板仓库，已下载的文件会保留供检查；
> - `-y 模式下不会自动覆盖`：目标目录已存在，先删除或换个项目名（交互模式下的覆盖会先清空该目录）；
> - `依赖安装失败`：会附带安装日志末尾几行，便于定位网络 / 源的问题，之后可手动执行提示里的命令；
> - `Git 仓库已创建，但首次提交失败`：通常是未配置 `user.name` / `user.email`，按提示配置后重新提交即可。

> **安装超时**：依赖安装默认 5 分钟超时，超时会终止整个安装进程（不会留下后台安装）；网络较慢时可用环境变量延长，例如 `EASYBUILD_INSTALL_TIMEOUT_MS=600000`。

### 方式二：手动下载

如果不使用 CLI，也可以直接从 GitHub 获取代码：

```bash
# 下载代码
git clone https://github.com/easybuild-jack/easybuild-admin-front.git my-project

# 进入目录并安装依赖
cd my-project
yarn install
```

> 推荐使用 **方式一**（CLI），自动完成项目名替换和初始化，省去手动修改的步骤。

---

## 一、 技术栈选型 (Tech Stack)

项目基于现代前端生态构建，坚持 **全链路类型安全** 与 **高性能** 原则：

| 领域 | 选型 | 说明 |
|------|------|------|
| **基础框架** | **Next.js 16 (App Router / Turbopack) + React 19** | 利用 React Server Components (RSC) 优化首屏并行渲染。 |
| **语言** | **TypeScript 6.x** | 严格模式，确保从 API 定义到 UI 组件的端到端类型安全。 |
| **样式体系** | **Tailwind CSS 4 + Lucide React** | 原子化 CSS，零运行时开销，配合 CSS Variables 实现动态主题。 |
| **组件库** | **Shadcn/ui (Radix UI)** | 无头 (Headless) 组件驱动，源码级可控，符合 WAI-ARIA 无障碍标准。 |
| **状态管理** | **Zustand 5** | 极简的状态流转，用于全局 UI 状态及同步的菜单数据管理。 |
| **数据通信** | **Axios + 统一拦截器** | 统一处理 Token 注入、多环境 BaseURL 切换与全局异常捕获。 |
| **表单方案** | **React Hook Form 7 + Zod 4** | 基于非受控组件的高性能表单，通过 Zod 实现声明式 Schema 校验。 |
| **表格方案** | **CustomTable（模板内置）** | 配置化表格组件，支持左右固定列、分页、行选择等。 |
| **富文本 / 交互** | **Tiptap 3 + @dnd-kit** | 富文本编辑与拖拽排序能力。 |
| **包管理** | **Yarn 4.7** | 模板使用 Yarn 4（`packageManager: yarn@4.7.0`）。 |

> 上表对应模板 **v1.0.0**（生成项目时的默认版本），具体版本以生成项目的 `package.json` 为准。

---

## 二、 核心架构设计 (Architecture)

项目采用 **六层解耦架构**，确保业务逻辑与基础能力的隔离：

1.  **访问控制层**：登录态校验与非法访问跳转（实现细节见生成项目的 `docs/开发文档.md`）。
2.  **Layout 系统**：基于 Next.js Layout 特性，实现嵌套布局、侧边栏自适应及平滑的主题切换引擎。
3.  **驱动架构 (Driver-Based)**：前端不维护静态路由表。菜单由后端下发 Resource Tree，前端运行时动态将其映射为应用路由。
4.  **业务组件层 (Higher-Order Components)**：对 Shadcn/ui 进行二次封装，提供 `CustomForm` 和 `CustomTable` 等配置化组件，覆盖 90% 的 CRUD 场景。
5.  **数据通信层 (API Internal)**：基于 Axios 的拦截器管道，统一处理 Token 注入、多环境 BaseURL 切换及全局异常捕获。
6.  **状态映射层 (State Matrix)**：Zustand 负责跨组件的同步状态（菜单、主题、登录用户等），服务端数据由 Axios 请求层按需获取。

---

## 三、 目录结构说明 (Project Structure)

```text
src/
├── api/             # API 模块化定义，按业务域拆分文件 (e.g., auth.ts, user.ts)
├── app/             # App Router 路由。包含 layout.tsx, page.tsx 及 api 路由
├── components/      # 组件库
│   ├── ui/          # 基类原子组件 (Shadcn/ui)
│   ├── custom/      # 核心业务高级组件 (CustomForm, CustomTable 等)
│   └── layout/      # 布局组件（侧边栏、顶栏、面包屑等）
├── config/          # 全局静态配置文件 (如主题配色、环境常量)
├── constants/       # 业务常量声明 (枚举、响应码等)
├── hooks/           # 通用的自定义 Hooks
├── lib/             # 外部库实例化 (Axios, Lucide, Crypto-JS 等)
├── mock/            # 内置零后端 Mock 引擎（开发态接口模拟）
├── store/           # Zustand 状态切片定义
├── styles/          # Tailwind 指令、全局 CSS 变量、自定义 Animations
└── types/           # 全局 TypeScript 类型声明 (.d.ts)
```

---

## 四、 开发规范 (Development Standards)

### 1. 编码约定
- **组件定义**：统一使用函数组件与 `Arrow Functions`。
- **文件命名**：组件目录使用 PascalCase；Hooks 使用 camelCase 且以 `use` 开头；类型文件以 `.types.ts` 结尾。
- **Props 调用**：必须声明接口 (Interface) 或类型 (Type)，严禁使用 `any`。

### 2. API 通信规范
- 所有接口必须定义请求参数与响应数据的 TS 类型。
- 业务异常必须通过 HTTP Interceptor 统一拦截处理，禁止在页面内重复编写 `try-catch`。

### 3. 组件封装原则
- **优先解耦**：尽量编写 Dumb Components (展示性组件)，将业务逻辑 (Side Effects) 抽离至自定义 Hooks。
- **配置驱动**：高级组件 (CustomForm/Table) 必须支持通过 JSON 配置项完全控制其渲染行为。

---

## 五、 核心技术实现细节 (Core Implementation)

### 动态菜单与路由映射
项目在初始化时调用 `queryMenu` 接口。通过递归算法解析后端返回的 `Resource[]` 数组：
1. 提取 `path` 与 `component` 的对应关系。
2. 注入 `Lucide` 图标动态加载。
3. 状态持久化至 Zustand 及本地 Storage，实现 30 分钟缓存机制。

### 配置化表单引擎 (CustomForm)
基于 `react-hook-form` 的 Controller 设计：
- 支持 `Grid` 布局自适应。
- 内置 `Zod` 进行异步/同步字段联动校验。
- 采用非受控模式，显著降低大表单输入的渲染延迟。

---

## 六、 开发环境常用命令

```bash
# 安装依赖 (Yarn v4)
yarn install

# 启动开发服务器 (默认端口: 4000)
yarn dev

# 生成生产环境构建产物
yarn build:prod

# 静态代码检查与质量控制
yarn lint
```

环境要求：CLI 自身需要 `Node.js >= 18.17.0`；生成的项目基于 Next.js 16，实际开发建议 `Node.js >= 20.9`（以模板 `package.json` 为准）。

---

## 七、 模版使用指南 — 创建后需改动的文件

使用本模版创建新项目后，请按照以下清单逐一修改，完成项目初始化。

### 1. 项目基础信息

| 文件 | 需改动项 | 说明 |
|------|----------|------|
| `package.json` | `name`、`version` | 将 `"easybuild-admin"` 改为你的项目名称，版本号按需设置。 |
| `src/app/layout.tsx` | `metadata.title`、`metadata.description` | 修改浏览器标签页标题与 SEO 描述，替换 `"EasyBuild Admin - 易构"` 为你的项目名称。 |
| `src/config/login/login-config.ts` | `name`、`description`、`subDescription` | 登录页的品牌名称和描述文案，直接替换即可。 |
| `public/favicon.ico` | 网站图标 | 替换为你自己的 Favicon。 |

### 2. 环境变量与接口地址

| 文件 | 需改动项 | 说明 |
|------|----------|------|
| `.env.development` | `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_APP_NAME`、`NEXT_PUBLIC_UPLOAD_API_URL` | 开发环境的后端 API 地址和文件上传地址。 |
| `.env.test` | 同上 | 测试环境配置。 |
| `.env.production` | 同上 | 生产环境配置。 |
| `src/config/api-url.ts` | `API_URLS` 对象 | **核心文件**。删除模版中的示例接口路径（如 `brand`、`banner`、`goods` 等），替换为你自己的业务接口地址。`auth` 部分如果后端遵循相同登录协议则可保留。 |

### 3. 业务页面与 API 模块（需删除 / 替换）

模版内置的以下目录包含 **示例业务代码**，创建新项目时应 **全部删除** 并替换为自己的业务模块：

| 目录 / 文件 | 说明 |
|-------------|------|
| `src/app/base/` | 示例：品牌、分类、分组、标签管理页面 |
| `src/app/commodity/` | 示例：商品、SPU 管理页面 |
| `src/app/operation/` | 示例：Banner 运营管理页面 |
| `src/app/order/` | 示例：订单、退款管理页面 |
| `src/app/customer/` | 示例：用户/会员管理页面 |
| `src/app/businesses/` | 示例：商超管理页面 |
| `src/app/system/` | 示例：字典管理页面 |
| `src/api/` 中的业务文件 | 如 `goods.ts`、`banner.ts`、`order.ts` 等，删除后按需新增自己的 API 模块。**保留** `http.ts`（Axios 封装）和 `upload.ts`（文件上传）。 |
| `src/types/` 中的业务类型 | 如 `goods.ts`、`order.ts`、`category.ts` 等，删除后新增自己的类型定义。**保留** `api.ts`（通用响应类型）和 `token.ts`（Token 类型）。 |

> **可保留的通用模块**：`src/app/auth/`（部门/角色/员工权限管理）和 `src/app/login/`（登录页）属于通用鉴权能力，如果后端接口兼容可直接复用。

### 4. 菜单图标与颜色映射

| 文件 | 需改动项 | 说明 |
|------|----------|------|
| `src/config/routes.ts` | `iconMap`、`colorMap` | 菜单图标和颜色由后端下发的 `resourceId` 匹配。删除模版中的示例映射（如 `brandManage`、`goodsInfoManage`），新增你自己的菜单 `resourceId` 对应的图标和颜色。图标从 `lucide-react` 中按需导入。 |

### 5. 可选调整项

| 文件 | 需改动项 | 说明 |
|------|----------|------|
| `src/config/constants.ts` | `API_CODE` | 如果后端返回的响应状态码字段不同（如用 `SUCCESS` 替代 `OK`），需要在此修改。 |
| `src/config/theme-colors.ts` | 主题色配置 | 可新增/删除主题配色方案，或修改默认主题。 |
| `src/config/pagination.ts` | `DEFAULT_PAGE_SIZE`、`PAGE_SIZE_OPTIONS` | 分页默认值，按业务需要调整。 |
| `src/middleware.ts` | 路由守卫规则 | 当前仅放行 `/login`，如需增加公开路由或加入 Token 校验逻辑，请在此修改。 |
| `src/lib/auth.ts` | Token 存储键名 | 如果 Token 的 `localStorage` 键名需与后端约定不同，在此修改 `access-token` 和 `user-info`。 |
| `src/api/http.ts` | 请求头 / 超时配置 | 如需调整 Token 请求头名称（默认 `Access-Token`）或超时时间（默认 `10000ms`），在此修改。 |

### 快速上手检查清单

```text
✅ 1. 修改 package.json 项目名
✅ 2. 配置三个 .env 文件的 API 地址
✅ 3. 修改 login-config.ts 和 layout.tsx 中的品牌信息
✅ 4. 删除 src/app/ 下的示例业务页面
✅ 5. 清理 src/api/ 和 src/types/ 中的示例文件
✅ 6. 在 api-url.ts 中定义自己的接口路径
✅ 7. 在 routes.ts 中配置菜单图标映射
✅ 8. 替换 public/favicon.ico
```

---

## 八、CLI 本仓库开发

上面第一～七节讲的都是脚手架**生成出来的模板项目**；这一节才是本仓库（`easybuild-admin` 脚手架）本身。

### 目录结构与职责

```text
src/
├── index.ts              # CLI 入口：参数解析、交互、流程编排
├── constants.ts          # 模板仓库地址、包管理器枚举
└── helpers/
    ├── download.ts       # degit 下载模板、owner/repo#ref 解析、错误翻译
    ├── release.ts        # 解析模板仓库最新正式 Release tag
    ├── setup.ts          # 改 package.json、git 初始化、安装依赖
    ├── validate.ts       # 项目名校验、目标目录检测
    └── logger.ts         # 终端输出样式
test/helpers.test.ts      # node:test 单元测试（纯函数）
docs/                     # 使用手册（前端脚手架使用手册.md）
eslint.config.js          # ESLint flat config
.github/workflows/ci.yml  # typecheck → lint → test → build
```

### 常用命令

```bash
npm install        # 安装依赖
npm run dev        # 源码方式直接运行 CLI（tsx src/index.ts）
npm run build      # 打包到 dist/（tsup，ESM）
npm run typecheck  # tsc --noEmit 类型检查
npm run lint       # ESLint 静态检查
npm test           # 单元测试（node:test）
```

> 发布前务必先 `npm run build`：`package.json` 的 `bin` 指向 `dist/index.js`，而 `dist/` 不进版本库。
