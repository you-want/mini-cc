# 第二章：我是如何剖析 Claude Code QueryEngine 与大模型交互机制的

大家好。今天，我们将继续探索 Claude Code 的核心源码。如果说上一章讲的架构是它的骨架，那么今天我们要聊的 **QueryEngine（查询引擎）**，绝对是它的大脑神经中枢。

作为一款 AI 编程助手，Claude Code 是怎么和远在天边的 Claude 3.5 模型对话的？当模型要求执行一个复杂的 Bash 命令时，本地又是怎么安全、实时地跑起来的？

学习完这章后，你会对以下内容有清晰的认识：
1. **QueryEngine 的核心使命**：它是怎么管理长达几个小时的上下文的？
2. **大循环（The Query Loop）**：揭秘 `while(true)` 里的惊天秘密。
3. **上下文瘦身术（Context Compaction）**：5 道防线，教你如何优雅地压缩上下文，既省钱又不丢关键信息。
4. **工具流式执行（Streaming Tool Execution）**：模型还没回答完，工具就已经跑起来了？
5. **动手实践**：给大循环加一个自定义的拦截器。

---

## 一、宏观视角：什么是 QueryEngine？

翻开 `src/query.ts` 源码，你会发现它的核心就是暴露了一个 `query()` 函数。它是一个极其复杂的**异步生成器（AsyncGenerator）**。

你可以把 QueryEngine 想象成一个“同声传译+执行官”。
- 接收我们的输入（比如：“帮我写个 Python 脚本”）。
- 把本地的代码、文件树、以及历史聊天记录打包好，通过 `callModel` 发给 Claude 大模型。
- **流式（Streaming）** 接收大模型的回复，一点点吐给终端 UI。
- 如果大模型在回复里夹带了“工具调用（Tool Use）”的指令，它能**实时拦截并执行**这些本地命令。
- 把执行结果再喂回给大模型，直到大模型说“任务完成”。

这一切，都被封装在一个巨大的 `while(true)` 循环中，也就是源码里的 `queryLoop` 函数。

---

## 二、精妙绝伦：上下文瘦身术（Context Compaction）

在使用大模型时，最大的痛点就是：**上下文太长了！**
Token 超限不仅会导致 API 报错（Prompt Too Long），而且非常费钱。我在看 `query.ts` 时，被它处理上下文的精细程度震惊到了。

在每次发请求给模型前，它会依次经过 **5 道防线** 来对上下文进行瘦身：

1. **预算控制 (`applyToolResultBudget`)**：
   - 比如你跑了一个 `cat package-lock.json`，结果返回了几万行。这里会强制给工具结果设定一个 Token 预算，超出的部分直接被截断或总结。
2. **历史裁剪 (`snipCompactIfNeeded`)**：
   - 如果开启了 `HISTORY_SNIP`，它会智能地裁掉历史对话中一些毫无营养的闲聊，释放 Token。
3. **微型压缩 (`microcompact`)**：
   - 这是对特定工具结果的压缩。比如你修改了一个文件，它可能只保留 Diff 差异，而不是把整个新旧文件都塞在上下文里。
4. **上下文折叠 (`contextCollapse.applyCollapsesIfNeeded`)**：
   - 将一些已经完结的中间步骤“折叠”起来，只保留最终结论。
5. **自动总结 (`autocompact`)**：
   - 终极大招。如果经过前面几步，Token 还是接近上限，它会触发 `autocompact`（背后其实是偷偷起了一个子代理），让模型自己把之前的长篇大论总结成一段精简的摘要，替换掉原来的几十条消息。

这段逻辑就像一个过滤漏斗，我在源码里给大家提炼出了骨架：
```typescript
// 摘自 src/query.ts 的 queryLoop 函数
let messagesForQuery = [...messages]

// 1. 限制工具输出大小
messagesForQuery = await applyToolResultBudget(messagesForQuery, ...)

// 2. 裁剪历史
if (feature('HISTORY_SNIP')) {
  const snipResult = snipModule.snipCompactIfNeeded(messagesForQuery)
  messagesForQuery = snipResult.messages
}

// 3. 微型压缩
const microcompactResult = await deps.microcompact(messagesForQuery, ...)
messagesForQuery = microcompactResult.messages

// 4. 上下文折叠
if (feature('CONTEXT_COLLAPSE')) {
  const collapseResult = await contextCollapse.applyCollapsesIfNeeded(messagesForQuery, ...)
  messagesForQuery = collapseResult.messages
}

// 5. 自动总结 (终极杀器)
const { compactionResult } = await deps.autocompact(messagesForQuery, ...)
if (compactionResult) {
  messagesForQuery = buildPostCompactMessages(compactionResult)
}
```

---

## 三、庖丁解牛：大循环与流式工具执行

上下文准备好了，接下来就是发请求给模型。这里有两大亮点：**无限循环**和**边看边做（Streaming Tool Execution）**。

### 1. The Query Loop (无限循环) 与它的“刹车机制”

`queryLoop` 为什么是一个 `while(true)` 循环？
因为很多编程任务不是一回合就能搞定的。比如你让它“修复这个 Bug”，它可能需要：
- 回合 1：调用 `grep` 搜索报错信息。（大模型返回 Tool Use，本地执行，进入下一循环）
- 回合 2：调用 `cat` 查看具体文件。（大模型返回 Tool Use，本地执行，进入下一循环）
- 回合 3：调用 `edit` 修改文件。（大模型返回 Tool Use，本地执行，进入下一循环）

**那么，这个 `while(true)` 到底是怎么停下来的呢？难道会一直死循环吗？**

当然不会。我在源码中找到了它的几种“刹车机制”：

**机制一：自然完结（最常见）**
当大模型认为任务已经完成，它在回复中**不再包含任何工具调用（Tool Use）**时，源码中一个叫做 `needsFollowUp` 的标记就会保持为 `false`。循环走到一半就会直接 `return` 跳出：

```typescript
// 摘自 src/query.ts
let needsFollowUp = false;

for await (const message of deps.callModel({...})) {
  // ... 如果模型返回了工具调用，就会把 needsFollowUp 设置为 true
  if (message.type === 'tool_use_block') {
    needsFollowUp = true;
  }
}

// 🎯 核心刹车点：如果模型没有调用工具，说明它回答完了
if (!needsFollowUp) {
  // ... 忽略一些错误恢复逻辑
  return { reason: 'completed' }; // 成功跳出死循环！
}
```

**机制二：最大回合数限制（防失控）**
如果遇到一个很难的 Bug，模型一直在疯狂试错调用工具怎么办？源码在每次循环的末尾加了强制熔断机制：

```typescript
// 摘自 src/query.ts 循环末尾
const nextTurnCount = turnCount + 1;

// 检查是否达到了最大回合数限制
if (maxTurns && nextTurnCount > maxTurns) {
  yield createAttachmentMessage({
    type: 'max_turns_reached',
    maxTurns,
    turnCount: nextTurnCount,
  });
  return { reason: 'max_turns', turnCount: nextTurnCount }; // 强制停车！
}
```

**机制三：用户手动打断（Ctrl+C）**
当你在终端按下 `Ctrl+C` 时，会触发 AbortController 信号，循环也会立刻安全退出：

```typescript
// 摘自 src/query.ts 的工具执行阶段
if (toolUseContext.abortController.signal.aborted) {
  return { reason: 'aborted_tools' }; // 用户喊停，立刻退出
}
```

正是这几道防线，保证了 `queryLoop` 既能不知疲倦地连续工作，又能在完成任务或遇到异常时优雅退出。

### 2. 流式工具执行 (`StreamingToolExecutor`)

以前的 AI 助手，都是等大模型把一整段话（包括工具调用的 JSON 参数）全都生成完，才去解析 JSON 并执行工具。这会导致很明显的卡顿。

但在 Claude Code 中，引入了 `StreamingToolExecutor`，实现了真正的“边看边做”：

```typescript
// 源码解析：工具流式执行准备
const useStreamingToolExecution = config.gates.streamingToolExecution
let streamingToolExecutor = useStreamingToolExecution
  ? new StreamingToolExecutor(tools, canUseTool, toolUseContext)
  : null;

// 在接收模型流式回复时：
for await (const message of deps.callModel({...})) {
  // 1. 先把模型的回复 yield 给终端 UI 显示
  yield message;
  
  // 2. 如果大模型正在生成工具调用的参数块 (tool_use)
  if (message.type === 'tool_use_block' && streamingToolExecutor) {
    // 只要拿到足够执行的参数，不等大模型说完，立刻扔进执行器！
    streamingToolExecutor.addTool(toolBlock, message)
  }
}

// 收集执行结果
for (const result of streamingToolExecutor.getCompletedResults()) {
  toolResults.push(result);
}
```
**这就好比：** 老板（大模型）一边在微信上打字给你安排任务，你（执行器）看到一半，发现需要查个资料，你就已经开始查了，等老板打完字，你的资料已经查好发回去了！这种并发设计极大地降低了任务的端到端延迟。

### 3. 容错与重试机制 (Fallback)
源码中还做了非常健壮的错误处理。比如，如果你用的 Claude 3.5 Sonnet 突然因为高峰期 API 限流了，它会抛出 `FallbackTriggeredError`：
```typescript
catch (innerError) {
  if (innerError instanceof FallbackTriggeredError && fallbackModel) {
    // 降级触发：切换模型并重试
    currentModel = fallbackModel;
    attemptWithFallback = true;
    
    // 丢弃失败的工具执行
    if (streamingToolExecutor) streamingToolExecutor.discard();
    
    // 给用户发个温柔的警告
    yield createSystemMessage(
      `Switched to ${fallbackModel} due to high demand...`,
      'warning'
    );
    continue; // 重新进入循环发起请求
  }
}
```

---

## 四、动手实践：给 QueryEngine 加个请求拦截器

光看源码不过瘾，我们来动手改一改。假设我们想在每次向大模型发请求前，强制加上一句话：“请用中文回答”。

我们可以直接在 `src/query.ts` 里的 `callModel` 调用前动手脚：

```typescript
// 打开 src/query.ts，在 queryLoop 函数中，找到 deps.callModel 调用的地方 (大概在 660 行左右)

// 🟢 我们的实战代码：拦截并篡改系统提示词
const myCustomPrompt = "\n\n【重要指令】：接下来的所有回复，请必须使用中文，并且尽量使用幽默的口吻！";
const hackedSystemPrompt = fullSystemPrompt + myCustomPrompt;

// 然后修改 callModel 的入参
for await (const message of deps.callModel({
  messages: prependUserContext(messagesForQuery, userContext),
  // 替换为我们篡改后的提示词
  systemPrompt: hackedSystemPrompt, 
  thinkingConfig: toolUseContext.options.thinkingConfig,
  tools: toolUseContext.options.tools,
  // ...
})) {
  // ...
}
```
这样一改，无论你在终端输入什么，大模型都会被强制“注入”我们的中文幽默设定。这就是理解了底层架构后，我们可以随心所欲“魔改”的快乐！

---

## 五、小结

QueryEngine 是 Claude Code 最核心的引擎。它通过精细的 **5 层上下文压缩** 解决了长对话的内存问题，又通过 **流式工具执行 (`StreamingToolExecutor`)** 榨干了每一毫秒的性能，最后通过一个健壮的 `while(true)` 状态机，完成了人与大模型、本地终端之间的完美协同。

Claude Code 源码系列还未完结。敬请期待！一键三连，关注不迷路。

---

## 六、推荐阅读

- [Anthropic 官方 Tool Use 文档](https://docs.claude.com/en/docs/build-with-claude/tool-use) —— 了解大模型是如何返回工具调用指令的。
- [JavaScript 异步生成器 (Async Generators)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) —— 搞懂 `yield` 和 `for await...of` 是怎么让数据流像水管一样源源不断的。
