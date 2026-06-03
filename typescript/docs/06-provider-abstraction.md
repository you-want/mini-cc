# mini-cc 的 Provider 抽象层是怎么设计的

## 引言

如果说工具系统让 AI 有了“动手”的能力，那么 Provider 层就是 AI 的“感官”——它负责接收用户的指令，把指令发给不同的大模型，再把模型返回的结果解析回来。

mini-cc 的目标是支持多个模型：Anthropic 的 Claude、OpenAI 的 GPT 系列，以及各种 OpenAI 兼容接口（比如 Qwen、DeepSeek、Kimi 等）。

但是，这些模型的 API 协议各不相同，上层代码如果直接耦合某个厂商的 SDK，后面换模型就麻烦了。

所以我设计了一个 Provider 抽象层，让上层代码（也就是 Agent 循环）只依赖一个统一的接口，底层具体是哪个 Provider 在干活，上层不关心。

这一篇就说说这个抽象层是怎么搭起来的，以及在实现过程中碰到的几个“协议差异”的坑坑。

## Provider 抽象的设计思想

Provider 层的核心目标很简单：**把不同 LLM 服务的差异隔离开，让上层代码只关心“发消息、收回复”这两件事**。

整体结构大概是这样的：

```
┌─────────────────────────────────────────────────────────┐
│                     Agent 层                            │
│                    (只依赖 LLMProvider 接口)             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Provider 层                          │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────┐  │
│   │ OpenAI        │  │ Anthropic     │  │  其他      │  │
│   │ Provider      │  │ Provider      │  │ Provider  │  │
│   └───────┬───────┘  └───────┬───────┘  └─────┬─────┘  │
└───────────┼──────────────────┼────────────────┼────────┘
            │                  │                │
            ▼                  ▼                ▼
      OpenAI API        Anthropic API      兼容 API
```

这套设计的核心是**策略模式**——对外暴露统一的 `LLMProvider` 接口，底层的具体实现可以随时替换。

## 核心接口定义

`LLMProvider` 接口定义在 `src/services/providers/index.ts` 里，代码量不大，但把核心能力都圈定了：

```typescript
export interface LLMProvider {
  modelName?: string;
  
  sendMessage(
    userMessage: string,
    onTextResponse: (text: string, isThinking?: boolean) => void,
    abortSignal?: AbortSignal
  ): Promise<ProviderResponse>;
  
  sendToolResults(
    results: { id: string; name: string; result: string; isError?: boolean }[],
    onTextResponse: (text: string, isThinking?: boolean) => void,
    abortSignal?: AbortSignal
  ): Promise<ProviderResponse>;
}
```

对应的返回结构也很简单：

```typescript
export interface ProviderResponse {
  text: string;
  toolCalls: ToolCall[];
}
```

这里有两个设计取舍值得说一下：

1. **工具调用结果通过独立方法 `sendToolResults` 返回**，而不是塞进 `sendMessage` 的参数里。
  - 这样做的原因是，Agent 循环的逻辑通常是：用户发消息 → 模型返回工具调用 → 执行工具 → 把结果还给模型 → 模型继续生成。
  - 这个循环自然分成了两个阶段，用两个方法对应起来，上层代码更清晰。

2. **两个方法都支持 `abortSignal`**。
  - 因为大模型 API 的响应时间可能很长，用户很可能在等待过程中按 Ctrl+C 取消。
  - `abortSignal` 让 Provider 层可以优雅地中断请求，而不是直接卡死。

## OpenAI Provider 实现

OpenAI Provider 的完整实现在 `OpenAIProvider.ts` 里。除了标准的 API 调用，还有几个值得一提的细节。

### 系统提示词注入

每次创建 Provider 时，会把系统提示词（System Prompt）预置到消息列表的开头。这个提示词定义了 AI 的角色、能力范围和一些默认行为：

```typescript
const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
messages.push({ 
  role: 'system', 
  content: '你是一个名为 mini-cc 的高级 AI 编程助手。...' 
});
```

核心内容在源码的第 23-26 行。

这里特别强调了**默认输出目录**（`../test_file`）和**防覆盖机制**（`require_new` 参数）。

这两个规则不是随便加的——早期的测试中，AI 经常把生成的文件直接扔在当前目录，或者直接把我已有的文件覆盖掉，让我（用户）体验很差。后来把这两条规则写进 System Prompt，问题基本解决了。

不过后续还可以看看有什么更好的解决办法吗？这部分我在考虑中。

### 流式响应 + 思维链展示

流式响应的处理代码在 `OpenAIProvider.ts` 的第 55-200 行（`createMessage` 函数）。

核心逻辑是遍历流式数据块，实时把内容推给回调函数。

有两个特殊的处理值得一提：

- **Qwen 模型的 `reasoning_content` 字段**。
  - Qwen 系列模型支持在生成最终回复之前输出“思考过程”，字段名是 `reasoning_content`。
  - 代码里专门判断了 `delta.reasoning_content` 是否存在，如果存在，就用 `isThinking=true` 标记，让 UI 层可以单独展示思考过程（比如用不同的颜色或缩进）。
  - 这个判断是通过 `baseURL.includes('dashscope.aliyuncs.com')` 来识别的，比较粗暴，但够用。

- **Ollama 格式的工具调用兼容**。
  - Ollama 的工具调用格式和标准 OpenAI 格式有点不一样，它会返回一个 JSON 块，而不是标准的 `tool_calls` 数组。
  - 代码里做了一个 buffer，先把内容攒起来，等流结束再尝试解析。这种做法不是最优解，但能让 mini-cc 同时支持标准 OpenAI 接口和 Ollama 本地模型，实测效果还行。

### 工具定义转换

把 mini-cc 内部的 `Tool` 接口转换成 OpenAI 兼容的 `function calling` 格式，代码在第 31-40 行：

```typescript
const getTools = (): OpenAI.Chat.ChatCompletionTool[] => {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as any,
    }
  }));
};
```

这里有一个坑：`tools` 是全局导入的，意味着所有 Provider 共享同一套工具列表。

如果某个 Provider 不支持某些工具，需要在调用前手动过滤。

目前 mini-cc 还没有做这个过滤，因为目前支持的 Provider 都支持标准的 function calling，暂时没出问题。

### JSON 解析容错

大模型生成的工具参数 JSON 经常有不规范的地方，比如换行符、制表符没有正确转义，导致 `JSON.parse` 直接报错。

`fixJsonString` 函数做了简单的转义修复，代码在第 45-50 行：

```typescript
const fixJsonString = (raw: string): string => {
  return raw
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
};
```

这个函数其实挺偷懒的，但覆盖了 90% 以上的“坏情况”。剩下的 10%，代码里会直接输出错误日志，把原始参数打印出来，方便排查。

## Anthropic Provider 实现

Anthropic Provider 的实现在 `AnthropicProvider.ts` 里，结构和 OpenAI Provider 类似，但有几个差异点。

这个就是实现一下，我觉得可能后续也不迭代，因为 Anthropic 反华，封禁的严重，我也没有什么好说的。我们后续基本应该不用这个。

### API 风格差异

Anthropic 的 SDK 用 `stream.on('text', callback)` 的方式处理流式响应，而不是 OpenAI 的 `for await (const chunk of stream)`。

两者都能实现流式输出，但 Anthropic 的事件模型更细粒度，支持 `text`、`tool_use`、`input_json` 等多种事件类型。

### 工具格式差异

工具定义的格式也有差异。OpenAI 的 `function` 结构比 Anthropic 多一层嵌套，Anthropic 直接把 `name`、`description`、`input_schema` 放在顶层：

```typescript
const getTools = (): Anthropic.Tool[] => {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as any,
  }));
};
```

这就是 Provider 抽象层存在的价值：上层代码调用 `sendMessage` 时完全不用关心底层用的是哪种格式，转换逻辑被封装在 Provider 内部。

### 系统提示词的位置

OpenAI 把 System Prompt 当作 `role: 'system'` 的消息塞进 `messages` 数组。

Anthropic 则有一个独立的 `system` 参数，和 `messages` 分开传递。这个差异在实现时被完全隐藏了。

## Provider 工厂模式

为了统一创建 Provider，写了一个简单的工厂函数：

```typescript
export function createOpenAIProvider(
  apiKey: string, 
  baseURL?: string, 
  model: string = 'gpt-4o'
): LLMProvider { ... }

export function createAnthropicProvider(
  apiKey: string,
  model: string = 'claude-3-7-sonnet-20250219'
): LLMProvider { ... }
```

注意 `createOpenAIProvider` 的 `baseURL` 参数是可选的。

这为兼容 OpenAI 接口的模型（Qwen、DeepSeek、Kimi 等）提供了便利：用户只需要把 `baseURL` 设置成对应服务商的地址，就能直接使用。

配置文件保存在 `~/.mini-cc/config.json`，用户可以用 `mini-cc config set` 命令切换模型和 Provider。

运行时通过 `/provider` 命令可以热切换，不需要重启进程。

## 流式响应的实际效果

流式响应的回调函数 `onTextResponse` 有两个参数：`text` 是内容片段，`isThinking` 标记这段内容是“思考过程”还是“最终回复”。

在 UI 层（基于 React + Ink 构建），不同的标记会用不同的样式展示。

思考过程用灰色斜体，最终回复用正常颜色。

Qwen 模型的 `reasoning_content` 会被正确归类到思考过程中，`content` 被归类到最终回复中。

一个典型的输出效果是这样的：

```
====== 思考过程 ======
用户问的是 package.json 里的项目名称，我需要先用 FileReadTool 读取文件。
====== 完整回复 ======
根据 package.json，这个项目的名称是 "my-awesome-project"。
```

把思考过程和最终回复分开展示，用户体验比那种“等 10 秒突然冒出一大段文字”要好很多。

## 总结

Provider 抽象层做下来，我的几个体会：

1. **接口统一是第一位的**。`LLMProvider` 接口虽然简单，但它让上层代码完全不依赖具体厂商。换模型只需换一个 Provider 实现，Agent 循环一行都不用改。

2. **协议差异要尽早识别**。OpenAI 和 Anthropic 的工具定义格式差异、系统提示词的位置差异，这些坑如果等到写代码时再处理，会浪费很多时间。提前梳理清楚，设计接口时留好扩展点。

3. **流式响应是标配**。大模型 API 的响应延迟普遍在秒级以上，不支持流式输出，用户体验会很差。Provider 层必须原生支持流式回调。

4. **兼容层比想象中重要**。很多国产模型用的是 OpenAI 兼容接口，但细节上可能有差异（比如 Qwen 的 `reasoning_content` 字段）。Provider 层里针对特定厂商的判断逻辑虽然看着有点 hack，但确实能让 mini-cc 在更多模型上跑起来。

**源码指路**：Provider 相关的核心代码都在 `src/services/providers/` 目录下。`index.ts` 定义了 `LLMProvider` 接口和 `ProviderResponse` 结构。`OpenAIProvider.ts` 实现了 OpenAI 及兼容接口的支持，`AnthropicProvider.ts` 实现了 Claude 官方的支持。工厂函数导出后，在 Agent 循环中被调用。

---

## 🌟 欢迎关注和支持

如果你觉得这个项目对你有帮助，欢迎：

- **⭐ Star 一下**：[GitHub 仓库](https://github.com/you-want/mini-cc)
- **📝 关注博客**：获取更多技术干货和项目动态
- **📱 关注公众号《与 IT 有约》**：第一时间收到最新文章推送

你的支持是我继续开发的动力！🚀

