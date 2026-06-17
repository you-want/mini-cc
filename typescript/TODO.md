>目标是让用户可配置多个模型，系统在运行时基于“成功率 / 延迟 / 成本”动态选型，核心诉求是**节省昂贵模型的 token**：能用便宜模型解决就不升级，只有在能力/质量/稳定性不满足时才升级到更贵模型；同时保持行为可控、可解释、可回滚。

**目标与边界**
- **目标**：在不改变用户调用习惯的前提下，新增一个 `auto` 路由模型；当用户选择 `model=auto`（或开启 auto 模式）时，系统自动在候选模型间切换。
- **核心权衡**：稳定性优先，其次省钱；“先便宜后升级”，避免“频繁抖动”与“不可解释的随机切换”。
- **边界**：v1 支持“同一家 provider 内多模型”与“跨 provider 多模型”；需要统一能力抽象（错误分类、能力匹配、费用估算）；不做复杂在线学习，只做规则 + 轻量统计。

---

**用户侧配置（建议形态）**
- 新增配置块 `auto`（放在现有配置文件结构中，不新造文件格式）：
  - `auto.enabled`: boolean
  - `auto.strategy`: `"tiered"`（默认：先便宜后升级） | `"fallback"` | `"balanced"` | `"cheapest"` | `"fastest"`
  - `auto.tiers`: 分档候选模型（更符合“省钱”的语义）
    - `cheap`: [{ `provider`, `model`, `weight?`, `capabilities?`, `price?` }]
    - `standard`: [{ ... }]
    - `premium`: [{ ... }]
    - `capabilities?`: `tools?`, `vision?`, `maxContextTokens?`, `structuredOutput?`
    - `price?`: 可选覆盖默认价目表（按 input/output token 单价）
  - `auto.candidates`（可选兼容形态）：不分档时使用，视为单一 tier（按顺序/权重参与）
  - `auto.budgets`：
    - `maxCostPerRequest?`：单次硬上限（超了不选/不升级）
    - `maxCostPerSession?`：会话硬上限（超了限制到更便宜的 tier）
  - `auto.constraints`（软约束，用于排序/打分）：
    - `maxP95LatencyMs?`
    - `minSuccessRate?`
  - `auto.behavior`：
    - `sticky`: `"session"` | `"request"`（默认 request；session 会减少抖动）
    - `cooldownMs`: 切换冷却，防抖
    - `retryOn`: 哪些失败触发重试（如 429/5xx/timeout）
    - `maxAttempts`: 单次请求最多尝试几次（防无限重试）
    - `manualOverride`: 用户手动切换模型时的行为
      - `mode`: `"disableAuto"`（默认：手动指定即完全不走 auto） | `"pinModel"`（只在 auto 内固定到某个模型） | `"pinTier"`（只在 auto 内固定到某个 tier）
      - `scope`: `"request"` | `"session"`（默认 session）
      - `ttlMs?`: 可选，手动固定的有效期；到期自动回到 auto
  - `auto.escalation`（决定“什么时候值得花更多钱”）：
    - `maxCheapAttempts?`: cheap tier 最多尝试几次
    - `reasons?`: 触发升级的原因集合（如 `ContextLengthExceeded` / `ToolCallInvalid` / `ModelCapabilityMismatch` / `QualityGateFailed`）
    - `qualityGates?`: 一组可解释规则（例如：要求 JSON 时必须可解析、工具调用参数必须齐全、输出必须满足用户硬约束）
- CLI/环境变量覆写（可选但很实用）：
  - `--model auto`
  - `--model <provider>:<model>`（手动指定模型，优先级高于 auto）
  - `--auto-pin-model <provider>:<model>`（仍启用 auto，但把选择固定到某个模型，便于临时“强制用某模型”）
  - `--auto-pin-tier cheap|standard|premium`（仍启用 auto，但把选择固定在某个 tier 内）
  - `--auto-resume`（取消固定，恢复 auto 选型）
  - `--auto-tiered`（等价于 `auto.strategy=tiered`）
  - `--auto-strategy cheapest`
  - `--auto-debug`（打印选择原因/统计）

---

**运行时策略（从简单到可演进）**
1) **Tiered（v1 默认：最省钱、可解释）**
- 核心：优先使用 `cheap` tier，只有触发升级条件才进入 `standard/premium`，避免把贵模型 token 用在“无必要”的请求上
- 升级条件：能力不匹配（tools/vision/ctx）、可恢复失败（超时/429/5xx）、质量门禁未通过（quality gates）
- 降级/防抖：`sticky` + `cooldownMs`，避免在 tier 间频繁跳转

1) **Fallback（兜底机制，Tiered 的组成部分）**
- 在同一 tier 内按顺序/权重尝试；遇到 `retryOn` 错误就换下一个候选
- 适用：最稳的失败恢复；单次最多 `maxAttempts`，避免无限重试与重复计费

1) **Balanced（v1.1，轻量打分）**
- 对每个候选维护滑动窗口统计：`successRate`, `avgLatency`, `estimatedCost`
- 每次请求前做一次打分：`score = w1*success - w2*latency - w3*cost`
- 加入约束与防抖：`cooldownMs` + `sticky`
- 适用：更接近“性价比最优”，但仍可解释（可打印各项分值）

1) **Cheapest/Fastest（可选策略，规则更硬）**
- cheapest：在满足能力（tools/vision/ctx）与成功率阈值下选最低成本（仍保留失败回退）
- fastest：在满足成功率阈值下选最低延迟
- 都需要 “fallback + budgets” 兜底，避免为了极致而失控

---

**需要补齐的基础能力（实现 auto 的前置抽象）**
- **统一错误分类**（决定是否重试、是否换模型）  
  - `RateLimit(429)`、`Timeout`、`Network`、`Server5xx`、`Auth`、`BadRequest/Prompt`、`ContextLengthExceeded`、`ToolCallInvalid` 等  
  - 其中 `Auth/BadRequest` 通常不应换模型重试（除非是“模型不支持该参数/工具”类 badrequest）
- **能力匹配**（避免选到不支持的模型）
  - 是否支持工具调用、是否支持视觉、最大上下文长度、是否支持结构化输出（如果项目有）
- **成本估算（省钱的基础）**
  - v1：用可配置价目表（按 input/output token 单价）；token 优先使用 provider usage
  - 没有 usage 时：用近似估算（标记为 estimate），用于排序与预算判断
- **上下文预算（直接省 token）**
  - 在进入模型前做上下文裁剪/去重/摘要（摘要优先用 cheap tier）
  - 对长对话/大文件引用做预算控制，避免无意义地把历史上下文喂给昂贵模型
- **统计存储**
  - v1：内存滑动窗口（进程内），可选落盘到现有缓存目录（避免重启全丢）
  - 指标：attempt 次数、成功/失败、延迟、token、估算成本、错误类型分布

---

**请求流程（行为定义清晰，便于实现与测试）**
- 输入：一次“生成/对话”请求（包含 messages、tools、maxTokens 等）
- 手动优先：若用户手动指定了模型/固定了 tier，则按 `manualOverride` 的规则决定是否绕过 auto 或在 auto 内固定
- 预处理：上下文预算（裁剪/摘要/去重），尽量减少输入 token
- 预选：过滤候选（能力不匹配/超预算/被熔断）
- 选择：按策略挑一个模型
  - tiered：先选 tier（cheap→standard→premium），再在 tier 内选具体模型
  - 其他策略：直接在 candidates 内选
- 执行：调用 provider
- 记录：写入统计（成功/失败/延迟/usage/cost）
- 失败处理：
  - 若错误类型在 `retryOn` 且未超过 `maxAttempts`：换下一个候选继续
  - 若命中升级条件（tiered）：进入更贵 tier 再尝试（仍受 budgets/attempts 约束）
  - 若是不可恢复错误：直接失败返回
- 输出：最终成功结果；若发生切换，在 debug 模式输出“切换链路与原因”

---

**可观测性与可解释性（建议必须有）**
- `auto` 每次选型生成一个可读的 decision 结构（不默认打印，debug 才打印）：
  - 候选列表、过滤原因、预算命中情况、tier/模型选择原因、最终得分/排序、重试与升级链路
- 若存在手动切换/固定：
  - 记录 override 的来源（CLI/配置/交互指令）、作用域（request/session）、是否绕过 auto 或固定到某个 tier/model
- 汇总命令（可选）：打印最近 N 次请求每个模型的 success/latency/cost（便于用户调参）

---

**安全与体验约束**
- 避免在不同模型间“语义漂移”导致质量不一致：  
  - 默认不做“同一请求多模型并发竞赛”，只做串行回退（成本可控）
- 避免重复计费：  
  - 串行重试要限制 attempts；升级受 budgets 约束；对“已产生大量输出后失败”的场景保守处理（例如不再升级到更贵 tier）
- 隐私与日志：  
  - 统计中不要落盘原始 prompt/response，只存数值指标与错误类型

---

**版本拆分（建议的里程碑）**
- **V1（可上线）**：`tiered + fallback` + budgets（request/session）+ 错误分类 + 能力过滤 + attempts/cooldown + debug 决策输出 + 上下文预算（基础版）
- **V1.1**：`balanced/cheapest/fastest` 选择策略 + 滑动窗口统计
- **V1.2**：持久化统计 + 简单熔断（某模型连续失败 N 次暂时禁用）

---

**验收标准（确认需求时就定死）**
- 用户配置多个模型，设置 `model=auto` 后：
  - 默认优先使用便宜 tier；只有满足升级条件才使用更贵模型（且可在 debug 中解释原因）
  - 有预算上限（request/session），不会无意间消耗过多昂贵 token
  - 429/timeout/5xx 时能自动切到备选并成功返回（在 attempts 限制内）
  - 能过滤不支持 tools/vision 的模型，不会选错导致必然失败
  - debug 模式能看到“为什么选它 / 为什么切换”
  - 不会出现无止境重试、频繁抖动（cooldown/sticky 生效）
  - 支持用户手动切换模型（request 或 session 级），且能恢复回 auto（resume）
