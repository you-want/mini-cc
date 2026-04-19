# 第三章：我是如何剖析 Claude Code 工具系统与命令执行机制的

大家好。今天，我们将继续探索 Claude Code 的核心源码。

在上一章，我们弄懂了 QueryEngine 是如何管理对话循环的。但你有没有想过，远在云端的 Claude 3.5 模型，究竟是怎么在你的电脑上敲下 `npm install`、是怎么搜索代码、又是怎么修改文件的？

如果没有“手脚”，再聪明的大脑也只是一台陪聊机。今天，我们就来揭开让 Claude Code 真正动起来的核心秘密——**工具系统（Tool System）**。

学习完这章后，你会对以下内容有清晰的认识：
1. **工具驱动架构**：为什么在 Claude Code 里“万物皆工具”？
2. **依赖注入与生命周期**：工具是怎么安全地跑起来的？
3. **深入 BashTool 源码**：它怎么处理长输出？怎么防止死循环？
4. **动手实践**：像官方一样，写一个真正的本地工具。

---

## 一、宏观视角：万物皆工具的架构之美

如果说大模型是“大脑”，那么 `src/Tool.ts` 就是让大脑长出三头六臂的“基因图谱”。

打开 `src/Tool.ts`，你会看到一个极其庞大且严谨的 `Tool` 泛型接口。所有的能力——无论是 `BashTool`、`GlobTool` 还是外部的 MCP 服务——全都是这个接口的实现。

为了让大家有个直观的感受，我把 `src/Tool.ts` 中 `Tool` 接口的核心定义摘录了出来：

```typescript
// 摘自 src/Tool.ts
export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // 1. 核心的执行逻辑：注入了大礼包 context
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>

  // 2. 严格的输入校验（基于 Zod）
  readonly inputSchema: Input
  
  // 3. 统一的权限拦截
  checkPermissions(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<PermissionResult>

  // 4. 统一的 UI 渲染
  renderToolUseMessage(
    input: Partial<z.infer<Input>>,
    options: { theme: ThemeName; verbose: boolean; commands?: Command[] },
  ): React.ReactNode
  
  // ... 其他诸如 isConcurrencySafe, interruptBehavior 等细节
}
```

为什么要这么设计？我在源码中看出了三个字：**大一统**。

- **统一的入参校验**：如源码中的 `readonly inputSchema: Input`。在大模型把 JSON 传过来时，系统第一步就是严格的类型校验，坚决不让非法的参数污染本地环境。
- **统一的权限拦截**：每个工具都要实现 `checkPermissions`。系统不用管你具体是什么工具，只要在这个层面上统一拦截，就能实现 `auto`、`plan`、`ask` 等多种权限模式。
- **统一的 UI 渲染**：`renderToolUseMessage` 要求返回 `React.ReactNode`，这直接把枯燥的执行日志变成了终端里漂亮的 React Ink 组件。

---

## 二、精妙绝伦：依赖注入与上下文大礼包

在传统的代码里，如果一个工具想读取系统状态，可能会写满各种 `import store from '...'` 的全局单例。但这在复杂的 Agent 系统中是一场灾难。

Claude Code 的做法非常优雅：**依赖注入（Dependency Injection）**。

每次调用工具的 `call()` 方法时，系统都会给它塞一个超级大礼包——`ToolUseContext`。我在源码里给大家提炼出了它的核心骨架：

```typescript
// 摘自 src/Tool.ts
export type ToolUseContext = {
  options: {
    tools: Tools                       // 让工具可以调用其他工具
    commands: Command[]                // 可用命令
    mcpClients: MCPServerConnection[]  // MCP 连接
    // ...
  }
  abortController: AbortController     // 极其重要！用来响应用户的 Ctrl+C 打断
  getAppState(): AppState              // 读取当前大环境状态
  setAppState(f: (prev: AppState) => AppState): void // 修改大环境状态
  readFileState: FileStateCache        // 文件状态缓存
  messages: Message[]                  // 当前的聊天历史记录
  // ...
}
```

这意味着什么？意味着一个工具在执行时，完全不需要关心外面的世界是怎么运转的。只要拿到这个 Context，它就能呼风唤雨。它甚至可以通过 `setAppState` 偷偷在后台起一个新的子任务进度条！

---

## 三、庖丁解牛：BashTool 里的魔鬼细节

为了让大家更有体感，我们来解剖一下系统里最危险、也最强大的工具：`src/tools/BashTool/BashTool.tsx`。

让大模型自由执行 Bash 命令，无异于让一个三岁小孩玩核按钮。官方是怎么防患于未然的呢？

### 1. 聪明的“只读/搜索”命令折叠

当你让模型去排查一个 Bug 时，它可能会疯狂地 `grep`、`cat`、`ls`。如果这些命令的输出全都堆在终端里，你的屏幕早就被刷爆了。

在 `BashTool.tsx` 的开头，我发现了一个叫做 `isSearchOrReadBashCommand` 的神奇函数：

```typescript
// 摘自 src/tools/BashTool/BashTool.tsx
const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis']);
const BASH_READ_COMMANDS = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'stat', 'file', 'jq', 'awk']);
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du']);

// 在 BashTool 对象里，它会使用这些白名单来做判断
export function isSearchOrReadBashCommand(command: string) {
  // ... (省略复杂的管道、重定向解析逻辑)
  const isPartSearch = BASH_SEARCH_COMMANDS.has(baseCommand);
  const isPartRead = BASH_READ_COMMANDS.has(baseCommand);
  // ...
  return { isSearch: hasSearch, isRead: hasRead, isList: hasList };
}
```

原来，系统维护了一份详细的“无害查询命令”白名单。当发现你在跑 `cat file | grep error` 时，UI 渲染层会直接把这些中间过程“折叠”起来，让你只看到最终的结论，界面清爽无比！

### 2. 拦截危险的“孤狼”睡眠（Sleep）

有时候大模型会犯傻，想等某个文件生成，于是直接敲了个 `sleep 10`。这会让整个主线程傻等 10 秒！

源码中专门写了一个 `detectBlockedSleepPattern` 拦截器：

```typescript
// 摘自 src/tools/BashTool/BashTool.tsx
export function detectBlockedSleepPattern(command: string): string | null {
  const parts = splitCommand_DEPRECATED(command);
  if (parts.length === 0) return null;
  const first = parts[0]?.trim() ?? '';
  
  // 识别整数秒数的 sleep
  const m = /^sleep\s+(\d+)\s*$/.exec(first);
  if (!m) return null;
  
  const secs = parseInt(m[1]!, 10);
  if (secs < 2) return null; // 2秒以内的缓冲是允许的，比如防限流

  const rest = parts.slice(1).join(' ').trim();
  // 如果单独跑 sleep N，会被拦截并建议大模型改用专用的后台监控工具！
  return rest ? `sleep ${secs} followed by: ${rest}` : `standalone sleep ${secs}`;
}
```

### 3. 长输出截断（防 Token 爆炸）

如果模型手滑，跑了一个 `cat package-lock.json`，几万行的输出不仅会挤爆终端，还会瞬间耗尽你的 API Token 预算（而且非常贵）。

Claude Code 采用了 `EndTruncatingAccumulator`。它不会把所有输出都塞进内存，而是像一个两头漏风的管子：保留开头的几百行，保留结尾的报错信息，中间的一大段全部替换为 `[... truncated ...]`。

```typescript
// 摘自 src/tools/BashTool/BashTool.tsx (工具执行阶段)
const stdoutAccumulator = new EndTruncatingAccumulator();

// ... 在命令执行完成或流式收集输出时 ...
stdoutAccumulator.append((result.stdout || '').trimEnd() + EOL);

if (result.code !== 0) {
  stdoutAccumulator.append(`Exit code ${result.code}`);
}

// 最终将截断后（保留头尾，中间省略）的字符串交给大模型
const stdout = stdoutAccumulator.toString();
```

这种设计既保证了大模型能看到执行结果的头尾（通常报错都在尾部），又极大地省了钱！

---

## 四、动手实践：写一个极简的本地工具

看了这么多源码，手痒了吗？官方提供了一个非常好用的 `buildTool` 辅助函数。我们来模仿源码的风格，写一个只读的 `GitStatusTool`，帮大模型快速获取当前仓库的干净程度。

```typescript
import { z } from 'zod/v4';
import { buildTool } from '../Tool.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 🟢 我们的实战代码：极简版 Git 状态工具
export const GitStatusTool = buildTool({
  name: 'GitStatus',
  description: '获取当前代码库的 git 状态',
  
  // 1. 严谨的输入校验
  inputSchema: z.object({
    directory: z.string().optional().describe('要检查的目录路径，默认当前路径')
  }),
  
  // 2. 告诉系统这是绝对安全的只读操作，不需要弹窗警告
  isReadOnly: () => true, 
  
  // 3. 核心执行逻辑
  async call({ directory }, context) {
    const cwd = directory || process.cwd();
    try {
      // 真实执行系统命令
      const { stdout } = await execAsync('git status --short', { cwd });
      return { 
        data: stdout.trim() || '当前分支很干净，没有任何未提交的修改。' 
      };
    } catch (error) {
      return { data: `执行失败: ${error.message}` };
    }
  }
});
```

只要把这个 Tool 注册进上下文的 `tools` 数组里，大模型就能随时调用它了！这就是工具驱动架构的魅力——插拔式扩展，毫无违和感。

---

## 五、小结

今天先到这，我们已经深入体会了工具系统作为 Claude Code “改变现实世界”桥梁的精妙之处。

通过一套统一的 `Tool` 接口，它实现了严格的 Zod 校验、基于 Context 的依赖注入，以及优雅的 UI 渲染折叠。而在看似简单的 `BashTool` 背后，隐藏着命令分类折叠、死等拦截、长输出截断等无数打磨细节。

Claude Code 源码系列还未完结。敬请期待！一键三连，关注不迷路。

---

## 六、推荐阅读

- [Zod 官方文档](https://zod.dev/) —— 学习如何在 TypeScript 中写出像魔法一样严谨的运行时类型校验。
- [Anthropic Tool Use 官方指南](https://docs.anthropic.com/en/docs/tool-use-examples) —— 了解大模型是如何理解你写的 `description` 和 `inputSchema` 的。