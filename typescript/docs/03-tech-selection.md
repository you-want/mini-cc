# 03. 技术栈：跟着 Claude Code 选 TypeScript + React + Ink

## 引言

mini-cc 的技术栈不是我自己拍脑袋定的——我是直接抄了 Claude Code 的作业。

当我把 Claude Code 的源码扒下来之后，我最大的感受是：原来是用 TypeScript 写的吗？TypeScript 做类型约束，React 写组件，再用 Ink 渲染到终端……这套组合拳打下来，让一个本来应该很「土」的命令行工具变得清晰、优雅、还特别好扩展。

今天这篇我就跟你聊聊：**这套技术栈在实际开发中它到底给我省了多少事。**

## 技术栈概览

先列个清单，这里面每一项都是 Claude Code 验证过的，我直接拿来用：

| 分类 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 语言 | TypeScript | 5.x | 主开发语言 |
| 框架 | React | 17.x | UI 组件开发 |
| 终端 UI | Ink | 3.x | 终端界面渲染 |
| 包管理 | pnpm | 9.x | 依赖管理 |
| 测试 | Jest | 30.x | 单元测试 |
| Anthropic SDK | @anthropic-ai/sdk | 0.36.x | 调用 Claude |
| OpenAI SDK | openai | 6.x | 调用 GPT |
| MCP SDK | @modelcontextprotocol/sdk | 1.29.x | 插件协议 |

---

## TypeScript：类型是我给代码上的第一道锁

### 为什么我非要用 TypeScript

Claude Code 用 TypeScript，我就跟着用了。但说实话，最开始我没想太多，只是觉得“大项目应该用”。真正写出感觉来，是碰到两个让我头疼的场景之后。

**场景一：工具返回结果不统一**

mini-cc 里有十来个工具，有的返回文件内容（字符串），有的返回执行状态（对象），有的返回搜索结果（数组）。如果不用 TypeScript，我在 `QueryEngine` 里处理工具返回结果的时候，得写一堆 `if (typeof result === 'string')` 之类的判断，或者靠注释提醒自己。

用 TypeScript 之后，我定义了一个 `ToolResult` 的联合类型：

```typescript
// src/infrastructure/tools/Tool.ts
type ToolResult = 
  | { type: 'text', content: string }
  | { type: 'error', message: string, code?: number }
  | { type: 'file', path: string, content: string };
```

然后每个工具的 `execute` 方法都必须返回这个类型，否则编译不过。

`QueryEngine` 里处理结果的时候，TypeScript 会强制我做类型收窄：

```typescript
const result = await tool.execute(args);
switch (result.type) {
  case 'text':
    console.log(result.content);  // result.content 是 string
    break;
  case 'error':
    console.error(result.message); // result.message 是 string
    break;
}
```

少了运行时判断，代码干净多了。

**场景二：不同 Provider 的参数差异**

Anthropic 和 OpenAI 的 API 虽然都是 chat completion，但细节不一样。比如消息格式：Anthropic 用 `{ role: 'user', content: '...' }`，OpenAI 也差不多，但 tool_calls 的字段名不同。更麻烦的是，有的 Provider 不支持流式，有的不支持工具调用。

如果只用 JS，我得在运行时各种 `if (provider.name === 'openai')`，然后祈祷自己没写错字段名。

TypeScript 帮我做了两件事：

1. **区分 Provider 的能力**：我在 `LLMProvider` 接口里定义了一个 `capabilities` 字段：

```typescript
interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  maxContextTokens: number;
}

interface LLMProvider {
  name: string;
  capabilities: ProviderCapabilities;
  // ...
}
```

2. **编译时阻止不可能的操作**：比如在代码里判断如果 `provider.capabilities.toolCalling` 为 false，就不允许调用带 tools 参数的 `chat` 方法。这个用 TypeScript 的条件类型可以做到，但我在 mini-cc 里用了更简单的方式：在 `QueryEngine` 里调用 `chat` 之前先检查这个标志，TypeScript 能保证我检查完之后，调用的是正确的重载。

实际上，我踩过一个坑：有一次我新增了一个 Provider（Ollama），它的 `capabilities.toolCalling` 是 false。但我在 `QueryEngine` 里忘了判断，直接传了 tools 参数进去。TypeScript 报错了——因为 `chat` 方法的签名在 `toolCalling` 为 false 时不允许传 tools 参数。这个错误在编译阶段就被拦截了，省了我上线后半夜起来修 bug。

**场景三：消息流的状态机**

mini-cc 的消息处理有一个状态机：`idle → thinking → tool_calling → executing → responding → idle`。我用 TypeScript 的枚举和泛型把这个状态机编进了类型系统：

```typescript
type MessageState = 
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool_calling', toolName: string, args: Record<string, any> }
  | { status: 'executing', toolName: string, result?: ToolResult }
  | { status: 'responding', content: string };

// 在代码里，根据不同的 status，TypeScript 会自动推导出可用的字段
function handleState(state: MessageState) {
  if (state.status === 'tool_calling') {
    console.log(state.toolName);  // ✅ toolName 存在
    console.log(state.content);    // ❌ 编译报错，content 不存在于 tool_calling 状态
  }
}
```

这个设计让我少写了一堆防御性代码，而且状态流转的逻辑一目了然。

### 总结一下 TypeScript 在 mini-cc 里的真实价值

不是简单的“类型安全”四个字，而是：

- **强制你设计好数据结构**：写 interface 的过程就是设计的过程，想不清楚就写不出来。
- **把运行时错误变成编译时错误**：改了一个接口，类型检查器会告诉你所有受影响的文件，不用自己翻。
- **让重构变得大胆**：因为你知道，只要编译通过，大部分逻辑就没错。

没有 TypeScript，mini-cc 也能写，但代码会膨胀 30% 以上，全是运行时类型判断和文档注释。而我最讨厌写注释。

---

## React + Ink：用 Web 那套写 CLI

### Ink 到底是个什么神器

Ink 这个东西，简单说就是让你用写 React 的方式写终端界面：

```tsx
import React from 'react';
import { render, Text, Box } from 'ink';

const App = () => (
  <Box flexDirection="column">
    <Text color="green">Hello, mini-cc!</Text>
    <Text>Current directory: {process.cwd()}</Text>
  </Box>
);

render(<App />);
```

你跑这个代码，终端里就会显示带颜色的两行字，而且自动处理了布局、换行那些麻烦事。

### Claude Code 为什么要这么干

我一开始也纳闷：CLI 工具老老实实打印文本不就行了，为什么要整 React 进去？

后来我试着写了一个稍微复杂的界面——带消息列表、滚动、加载动画——我才发现，用原生 `console.log` 去管理这些东西简直是灾难。你要手动计算光标位置、清屏、处理输入……太容易出 bug 了。

而用 Ink：
- **组件化**：`WelcomeBanner`、`MessageList`、`ProgressBar`，每个组件独立写独立测。
- **状态管理就是 React 那套**：`useState`、`useEffect`，和写网页一模一样，零学习成本。
- **可以直接用 React 生态**：想加个 spinner？有现成的 `ink-spinner` 组件。

比如 mini-cc 里的启动欢迎界面：

```tsx
// src/components/WelcomeBanner.tsx
export const WelcomeBanner = ({ model, provider }: {
  model: string;
  provider: string;
}) => (
  <Box borderStyle="single" padding={1}>
    <Text bold color="cyan">mini-cc CLI {VERSION}</Text>
    <Box marginTop={1}>
      <Text>Model: </Text>
      <Text color="green">{model}</Text>
    </Box>
    <Text>Provider: {provider}</Text>
  </Box>
);
```

这段代码渲染出来就是一个带边框的盒子，里面显示当前模型和 Provider。你换成纯文本打印得写几十行 `console.log` 加一堆对齐计算。

![mini-cc 启动界面](../assets/mini-cc.png)
*(这就是 WelcomeBanner 渲染出来的实际效果，是不是比纯文本漂亮多了？)*

### 实际开发中的另一个好处：消息自动滚动

```tsx
const VirtualMessageList = ({ messages }: { messages: Message[] }) => {
  const containerRef = useRef<Element>();
  
  useEffect(() => {
    // 每次新消息进来，自动滚到底部
    if (containerRef.current) {
      scrollToBottom(containerRef.current);
    }
  }, [messages]);  // 依赖 messages，一变化就滚动
  
  return (
    <Box flexDirection="column" ref={containerRef}>
      {messages.map((msg, idx) => (
        <MessageItem key={idx} message={msg} />
      ))}
    </Box>
  );
};
```

这个 `useEffect` 的模式，写过 React 的人都懂。用原生方案你得手动监听消息数组的变化，还要处理滚动逻辑，代码会啰嗦很多。

**源码指路**：所有 UI 组件都在 `src/components/` 目录下，你可以看看我是怎么用 Ink 搭界面的。

## pnpm：真的快，而且省硬盘

Claude Code 用 pnpm，我也是一直在用的，我的项目基本都是 pnpm。对比一下我的真实体验：

| 场景 | npm | pnpm |
|------|-----|------|
| 首次安装 | ~30 秒 | ~35 秒（差不多） |
| 第二次以后安装 | 还是 ~30 秒 | ~5 秒（有缓存） |
| 磁盘占用 | 200 MB+ | ~80 MB（硬链接） |
| 幽灵依赖问题 | 有（比如你忘了装某包但它能跑） | 无（严格隔离） |

我用 pnpm 的理由很简单：

![pnpm vs npm 对比](../assets/pnpm-speed.png)
*(漫画图：左边 npm 像乌龟爬，右边 pnpm 像火箭飞)*

- **快**：平时改完代码 `rm -rf node_modules` 再重装，npm 要等半分钟，pnpm 几秒就好。
- **省空间**：我电脑上有好几个 TypeScript 项目，pnpm 把相同的包硬链接到一个地方，整体少占了几 GB。
- **安全**：不会出现“我没装 `lodash` 但代码里 `require('lodash')` 居然能跑”这种怪事。

**使用提示**：如果你想跑 mini-cc，确保你本地有 pnpm。没有的话 `npm i -g pnpm` 装一下就行。

## Jest：测试也可以不痛苦

### 为什么选 Jest

Claude Code 用 Jest，我也用 Jest。它的好处是：

1. **开箱即用**：TypeScript + React 项目，配一下 `jest.config.js` 就能跑。
2. **快照测试**：对 UI 组件太友好了，不用手动写几百个断言。
3. **Mock 简单**：想模拟一个函数或者模块，几行代码搞定。

### 安全测试的例子

mini-cc 的权限系统里，我需要确保危险命令被拦截：

```typescript
// src/__tests__/security.test.ts
describe('Security Tests', () => {
  test('should block dangerous commands', () => {
    const result = checkCommand('rm -rf /');
    expect(result.isDangerous).toBe(true);
  });
  
  test('should allow safe commands', () => {
    const result = checkCommand('ls -la');
    expect(result.isDangerous).toBe(false);
  });
});
```

跑一下 `pnpm test`，几秒钟就知道权限逻辑没被改坏。

### 快照测试的实际应用

对于 Ink 组件，快照测试特别爽：

```typescript
import { render } from 'ink-testing-library';
import { WelcomeBanner } from '../components/WelcomeBanner';

test('renders welcome banner correctly', () => {
  const { lastFrame } = render(
    <WelcomeBanner model="gpt-4" provider="OpenAI" />
  );
  expect(lastFrame()).toMatchSnapshot();
});
```

第一次运行会生成一个 `__snapshots__` 文件，里面存了终端的输出快照。以后如果你不小心改动了组件的外观，测试会失败并提示你差异在哪里。确认改动是故意的，按 `u` 更新快照就行。

**源码位置**：所有测试都在 `src/__tests__/` 目录下，你可以参考着写自己的测试。

完全理解。原稿那个表格看起来是在硬找理由，不够自然。我重新写一版，把你的真实想法加进去：你是全栈、因为 Claude Code 用 TS 所以我也用 TS、后续会用 Python/Go/Rust 再写版本。另外加上了 OpenAI 从 TS 迁移到 Rust 的业界案例，让这段更有说服力。

下面是重写后的版本，替换原文中 "## 为什么不选别的？" 及其后所有内容即可：

---

## 为什么不选别的？

有些朋友可能会问：Rust 性能更好，Go 部署更简单，为什么偏要用 TypeScript？

说实话，这个问题问得有点“非黑即白”了。TypeScript 和 Rust/Go 不是“你死我活”的关系，而是**不同阶段、不同场景**的选择。

我的真实情况是这样的：

### 1. 因为 Claude Code 用 TS，所以我也用 TS

我一开始就是想复刻 Claude Code 的核心机制。既然它的源码是 TypeScript，我直接抄过来改就行，没必要自己重新发明一套。这是最务实的理由，没什么好遮遮掩掩的。

### 2. 因为我是全栈偏前端，TS 我最熟

我是全栈开发者，日常主要写 TypeScript/React/Node.js。让我用 TS 写 mini-cc，我闭着眼睛都能写。换 Go/Rust 的话，我稍微吃力一点，需要多花一点时间。时间成本摆在这儿。

### 3. 后续会用 Python、Go、Rust 各写一版

这也是很多朋友问过我的问题："mini-cc 以后会支持其他语言吗？"

我的答案是：会的。

你看我的 GitHub 仓库 [`https://github.com/you-want/mini-cc`](https://github.com/you-want/mini-cc)，里面其实已经有了 Python、Go 的雏形。只是目前 TS 版本功能最全，是我的“先行版本”。后续我会用 Python、Go、Rust 分别重写一版，把核心 Agent 逻辑用不同语言实现一遍。

这件事对我来说有两个意义：
- **练习**：作为全栈，这几种语言我都要会用，用实际项目来练手最有效。
- **对比**：不同语言写出来的 Agent 在性能、开发效率、部署体验上到底差多少？我想亲自验证一下。

所以 TS 版本不是“唯一”版本，而是“第一个”版本。

### 4. 业界也在做类似的事：TypeScript for iteration，Rust/Go for production

你看 OpenAI 的操作就很有意思。2025 年，OpenAI 宣布把 Codex CLI 从 TypeScript 重写为 Rust。官方给出了四个原因：
- 零依赖安装（不用装 Node.js）
- 原生安全绑定（更好的沙箱）
- 优化性能（无 GC，内存占用更低）
- 可扩展协议（支持多语言扩展）

但注意：OpenAI 不是“抛弃”了 TypeScript，而是用 Rust 重写生产版本，同时 TypeScript 版本还在并行维护，直到功能对齐。这是一个清晰的策略：**用 TS 快速迭代验证，用 Rust 上线交付**。

Claude Code 和 Google 的 Gemini CLI 至今仍然用 TypeScript + React + Ink。

Anthropic 工程师 Boris 说过一句话：他们希望用一个“模型已经很擅长”的技术栈来开发 Claude Code——大约 90% 的 Claude Code 代码是由 Claude Code 自己写的。这是一个很巧妙的自我强化循环。

说到这，插一嘴，这也是为啥 AI Coding 之后，前端工程师处境最难受。但是也是机遇，因为 AI Coding 之后，前端工程师需要更关注 AI 技术，而不是 UI 设计。

**行业格局很清晰**：

| 语言 | 代表项目 | 适用场景 |
|------|---------|---------|
| TypeScript | Claude Code、Gemini CLI | 快速迭代、生态丰富、UI 炫酷 |
| Go | OpenCode | 并发好、部署简单、单二进制 |
| Rust | OpenAI Codex CLI | 极致性能、安全、零依赖安装 |
| Python | Aider | AI 生态成熟、原型开发快|

这不是“谁更好”的问题，而是“哪个更适合当前阶段”的问题。

### 5. 那 mini-cc 到底怎么选？

我给自己的策略是：

- **现在（TS 版本）**：快速实现核心功能，验证架构设计，顺便把技术文档写清楚。
- **未来（多语言版本）**：用 Go 和 Rust 各写一个“生产版”，对比性能和部署体验。Python 版本用来做 AI 原型测试。

说到底，我是个全栈工程师，写 TypeScript 是我的日常，写 Go/Rust/Python 是我的训练。mini-cc 正好是一个绝佳的练手项目：逻辑不算太复杂，但又能把各种语言的核心特性都用到。

所以别再问我“为什么选 TypeScript 不选 Rust”了——我都会，我都要写。

---

**源码指路**：GitHub 仓库 [`https://github.com/you-want/mini-cc`](https://github.com/you-want/mini-cc) 里可以看到多语言的目录结构。TS 版本是完整实现，其他语言的版本还在逐步完善中，欢迎关注和贡献。

---

## 架构与技术的完美契合

最后放一张图，看看技术栈是怎么和分层架构对应的：

![架构与技术栈](../assets/architecture-tech.png)
*(把上面的 ASCII 图换成彩色的架构图，每层用不同颜色，标注对应技术)*

```
┌──────────────────────────────────────────────┐
│  UI Layer (React + Ink)                     │
│  - WelcomeBanner 组件                       │
│  - VirtualMessageList 组件                  │
│  - ProgressBar 组件                         │
├──────────────────────────────────────────────┤
│  Application Layer (TypeScript)             │
│  - QueryEngine (Agent 循环)                 │
│  - SkillManager (技能管理)                   │
│  - ToolRegistry (工具注册)                   │
├──────────────────────────────────────────────┤
│  Infrastructure Layer (Node.js)             │
│  - FileReadTool / FileWriteTool            │
│  - BashTool (命令执行)                      │
│  - MCP Client (插件集成)                    │
└──────────────────────────────────────────────┘
```

每一层都有自己的技术侧重点：
- 最上层只管展示，用 React 组件拼界面
- 中间层是纯逻辑，TypeScript 做类型约束
- 底层用 Node.js 的 fs、child_process 等原生模块干重活

这个结构是 Claude Code 用过的，我直接搬过来，没踩什么坑。

## 总结

mini-cc 的技术栈说白了就是一句话：**Claude Code 用什么，我就用什么**。不过也是 mini-cc 的一个 TS 版本而已。后续会有其它版本。

这个选择给我带来了三方面的实际好处：

1. **开发体验好**：TypeScript 的类型安全 + React 的组件化 + pnpm 的快，写代码很舒服。
2. **站在巨人肩膀上**：不用纠结“这个库行不行”，Claude Code 已经帮我验证过了。
3. **社区贡献简单**：会用 React 和 TypeScript 的人很多，别人想给我提 PR 也没什么门槛。

最后再放一次源码地址：  
[https://github.com/you-want/mini-cc/tree/main/typescript](https://github.com/you-want/mini-cc/tree/main/typescript)

欢迎 clone 下来跑一跑，顺便 star 一下 ⭐️
