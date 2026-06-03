好，既然文章已经发表，接下来就按你梳理的五个阶段，做一份能落地执行的详细规划书。这份规划书不是写给读者看的“漂亮蓝图”，而是给你自己用的——每一步都具体到“学什么、做什么、怎么验证”。

---

# AI Agent 工程化学习规划书（实战版）

> 目标：用 3-6 个月的时间，系统掌握 Agent 工程化所需的核心技能，能独立搭建 Agent 运行环境、调试工具、评测平台，并对标 JD 达到“能干活”的水平。  
> 原则：不做 Demo 搬运工，每一个阶段都要产出可运行、可展示的成果。  
> 适合人群：有前端基础（TS/JS），会一点 Python，想转型 Agent Infra / Agent 工程岗。

---

## 第一阶段：AI Coding —— 工具即伙伴（预计 2-3 周）

### 目标
- 把 AI 编程工具真正融入日常开发，理解它们的“能力边界”和“调用方式”
- 能够调试并扩展 AI 编程工具的行为（不只是补全代码）

### 学习内容
| 主题 | 具体内容 |
|------|----------|
| Cursor / Copilot 深度使用 | 从 Chat、Composer、Cmd+K 开始，到上下文引用（@Files、@Docs）、自定义规则 |
| Claude Code 基础 | 安装、配置、使用自然语言驱动开发任务（如写一个 CLI 工具） |
| 原理理解 | Context Window 如何影响补全质量；Token 计费与截断；System Prompt 与 User Prompt 的区别 |
| 二次开发入门 | Claude Code 的 MCP 集成方式；Cursor 的规则文件（.cursorrules）编写 |

### 实践项目（必做）
1. **用 Cursor + Claude Code 合作开发一个小工具**（比如一个批量重命名文件的脚本），全程不用手动写代码，只通过 Prompt 驱动，并记录遇到的“误解”和修正过程。
2. **写一份 .cursorrules 文件**，定制你项目的代码风格、禁止使用的库、常用导入模板。
3. **尝试在 Claude Code 中接入一个本地工具**（比如调用自己写的 Python 脚本），理解 Tool Use 的基本流程。

### 验收标准
- [ ] 能独立用 AI 工具完成一个 200 行以内的脚本开发，80% 的代码由 AI 生成且无需反复修正。
- [ ] 能解释清楚 Context Window 导致的失败案例，并给出应对策略。
- [ ] 完成一次简单的 Tool Call 调用（哪怕是调用天气 API）。

---

## 第二阶段：Agent Framework —— 搞懂 Runtime（预计 4-6 周）

### 目标
- 不只会调用 API，而是理解 Agent 的“运行时”是如何管理记忆、工具、循环的
- 能够手写一个极简版 Agent Loop

### 学习内容
| 框架 | 重点学习点 |
|------|-------------|
| LangChain | LCEL、RunnableWithMessageHistory、Tool 定义与绑定、AgentExecutor 工作原理 |
| OpenAI Agents SDK | 单一 Agent、Handoff、工具调用、Span 追踪 |
| AutoGen / CrewAI | 多 Agent 协作模式（对话、层级、群组） |
| 核心原理 | ReAct 模式、Plan-and-Solve、CoT；Agent 内部状态（messages, intermediate_steps） |

### 实践项目（3选2，但建议全做）
1. **用 LangChain 实现一个“查天气 + 算算术”的 Agent**，并手动打印出每一步的 `thought` 和 `action` 日志。
2. **用 OpenAI Agents SDK 实现一个“客服主管 Agent”**，可以 Handoff 给“退货专员 Agent”和“物流专员 Agent”，并记录调用链路。
3. **手写一个最简单的 Agent Loop**（伪代码也行）：while not done: 调用 LLM → 解析 tool call → 执行 tool → 追加结果到消息列表。理解这个循环后，再用 LangChain 对比差异。

### 验收标准
- [ ] 能画出自己实现的 Agent 的消息流转图（输入→LLM→解析→工具执行→输出→下一轮）。
- [ ] 能解释 LangChain 中 `agent.run()` 和 `agent_executor.invoke()` 的区别，以及中间发生了什么。
- [ ] 跑通至少一个多 Agent 协作场景，并记录 handoff 时的上下文传递方式。

---

## 第三阶段：MCP / Function Calling —— 调度核心（预计 3-4 周）

### 目标
- 深入理解 Tool Calling 的协议层实现，能够自定义 MCP Server
- 掌握 Function Calling 的安全与性能优化

### 学习内容
| 概念 | 细节 |
|------|------|
| Tool Calling 规范 | OpenAI Function Calling、Anthropic Tool Use 的消息结构差异 |
| MCP 协议 | MCP 的三大原语：Resources、Tools、Prompts；JSON-RPC 消息格式 |
| 实现一个 MCP Server | 使用 Python MCP SDK 或 TypeScript MCP SDK |
| Tool 安全 | 沙箱执行、参数注入防范、权限最小化 |

### 实践项目
1. **用 MCP SDK 写一个 Server**，暴露两个 Tool：`read_file(path)` 和 `grep(keyword)`，然后让 Claude Code 或任意 MCP 客户端调用它。
2. **对比 OpenAI Function Calling 和 Anthropic Tool Use 的 JSON Schema 差异**，写一份笔记。
3. **实现一个简单的 Tool Runtime**：接收 Tool Call 请求 → 校验参数 → 执行 → 返回结果，并记录耗时和错误。

### 验收标准
- [ ] 本地成功运行 MCP Server，并用 `mcp-cli` 或 Claude Code 完成一次完整调用。
- [ ] 能解释为什么 Tool Call 的结果要放在 `tool` role 下，而不是 `user`。
- [ ] 完成一个带参数校验的 Tool，当传入非法路径时返回友好错误而不是崩溃。

---

## 第四阶段：Docker / Kubernetes —— Agent 服务化（预计 4-5 周）

### 目标
- 能够将 Agent 封装为容器化服务，并部署到 K8s 上运行
- 理解容器化对 Agent 资源、日志、扩展性的影响

### 学习内容
| 技术 | 重点 |
|------|------|
| Docker | 多阶段构建、.dockerignore、ENTRYPOINT vs CMD、镜像大小优化 |
| Kubernetes | Pod、Deployment、Service、ConfigMap、Secret、水平伸缩（HPA） |
| Agent 特有考虑 | 每个 Agent 一个 Pod 还是共享 Pod？会话亲和性（sticky session）；模型 API 的速率限制处理 |

### 实践项目
1. **将第二阶段实现的 LangChain Agent 打包成 Docker 镜像**，并通过 `docker run` 运行，提供 HTTP API（使用 FastAPI）。
2. **写一个 K8s Deployment 文件**，部署 2 个副本的 Agent 服务，并配置 Service 和 Ingress。
3. **模拟高并发**：用 `hey` 或 `wrk` 对 Agent 服务发送请求，观察 CPU/内存，并配置 HPA 自动扩容。

### 验收标准
- [ ] 镜像大小控制在 1GB 以内（含 Python 依赖和模型代码）。
- [ ] 成功在 minikube 或云上 K8s 集群中运行 Agent 服务，并能通过 curl 调用。
- [ ] 能说出 Agent 容器化与普通 Web 服务的两个关键区别（例如：长对话的上下文缓存、模型 Token 的速率限制）。

---

## 第五阶段：Agent 可观测性 —— 让迭代有据可依（预计 3-4 周，与前面重叠推进）

### 目标
- 为 Agent 系统添加完整的 Trace、Log、Metrics
- 开发一个简易的轨迹回放前端页面

### 学习内容
| 方向 | 工具/方法 |
|------|------------|
| 日志结构化 | JSON 格式，记录每个 Agent step 的 input、output、tool_calls、latency |
| Tracing | 使用 OpenTelemetry 或 LangSmith / Arize Phoenix |
| 指标 | Token 使用量、工具调用次数、错误率、端到端延迟 |
| 前端可视化 | 用 TypeScript + React 实现 Timeline 组件，展示 Agent 的思考-行动链条 |

### 实践项目
1. **改造第三阶段的 Agent，为每个 step 输出结构化日志**，并用 ELK 或 Loki 收集。
2. **接入 LangSmith（免费版可用）**，记录一次完整的 Agent 对话，并截图/导出 trace 链接。
3. **用 Next.js 或 Vite + React 写一个简单的 Trace Viewer**：输入一个 trace ID，展示每个 step 的 icon（🤔思考、🔧工具调用、✅输出）和时间轴。数据可暂时从 JSON 文件读取。

### 验收标准
- [ ] 能通过日志定位到一个 Agent 决策错误的具体 step（比如工具参数传错了）。
- [ ] 前端页面可以展示至少 5 个 step 的轨迹，并支持折叠/展开查看详情。
- [ ] 能算出一次完整对话消耗的总 Token 数（从 trace 数据中汇总）。

---

## 整体时间线建议

| 月份 | 重点阶段 | 产出 |
|------|----------|------|
| 第 1 个月 | 一阶 + 二阶 | 手写 Agent Loop，多 Agent 协作 Demo |
| 第 2 个月 | 三阶 + 四阶（部分） | MCP Server，Docker 化 Agent 服务 |
| 第 3 个月 | 四阶（K8s） + 五阶 | K8s 部署，轨迹回放前端原型 |
| 第 4 个月（可选） | 集成打磨 + 对标 JD 加分项 | 完整项目：RL 训练链路接入（简单版）/ CTF 挑战集成 |

## 每日/每周执行建议

- **每周保证 10-15 小时**（工作日 1.5h，周末每天 3-4h）
- **每阶段结束时产出**：一篇笔记（公开或私有）+ 一个可运行的最小 demo
- **遇到坑就记下来**：形成“踩坑与解决”库，这本身就是面试素材

---

这份规划书的目标不是“学完所有”，而是**做完所有实践项目**。每完成一个阶段，你就离 JD 里的要求更近一步。后面的文章就可以按这个顺序一篇篇写出来——真实记录你每一步的尝试、失败和收获。