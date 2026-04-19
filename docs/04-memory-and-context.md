# 第四章：我是如何扒开 Claude Code 记忆与上下文压缩机制的

大家好。今天，我们将来到 Claude Code 源码剖析之旅的最后一站。

在前面三章，我们了解了系统的架构、看懂了查询循环，也知道它是怎么挥动“工具”这把利剑的。但如果没有“记忆”，再强大的大脑也只是一条七秒记忆的金鱼。

你一定遇到过这种绝望的时刻：
- 排查一个 Bug 聊了半个小时，大模型突然开始“失忆”，连刚才改过什么文件都忘了；
- 或者你一次性塞给它整个项目的日志，结果直接报 `400 Token Limit Exceeded`，连话都不让说了。

面对动辄几万行的代码库和漫长的排查过程，Claude Code 是如何做到“不遗忘关键信息”同时又“不撑爆 Token 预算”的？遇到需要独立试错的子任务，它又是如何做到分身乏术的？

今天，我们就深入 `src/services/compact/`、`src/memdir/` 和 `src/tools/AgentTool/` 的源码，一探究竟。

学习完这章后，你会对以下内容有清晰的认识：
1. **断臂求生：** 连压缩请求本身都超载了，系统该怎么自救？
2. **反共识的记忆：** 没有向量数据库，它是怎么管理全局记忆的？
3. **Agent 分身术：** 它是如何开小号、在沙箱里安全试错的？
4. **动手实践：** 像官方一样，用几十行代码写一个自己的记忆管理器。

---

## 一、断臂求生：上下文压缩机制（Context Compression）

在大模型 API 中，上下文窗口不仅是有限的，而且越长越贵。当对话历史越来越长，Claude Code 会主动触发压缩机制（Compact），把历史记录精简。

我们来看看 `src/services/compact/compact.ts` 里的魔鬼细节。

### 1. 极致的 Token 抠门：剥离图片与冗余件

在请求大模型做对话总结之前，系统会做一次“大瘦身”。因为把几兆的截图重新发给模型，仅仅为了让它生成一句“刚才用户发了一张报错截图”，是极度浪费钱的。

```typescript
// 摘自 src/services/compact/compact.ts
export function stripImagesFromMessages(messages: Message[]): Message[] {
  return messages.map(message => {
    if (message.type !== 'user') {
      return message
    }

    const content = message.message.content
    if (!Array.isArray(content)) {
      return message
    }

    // 扫描内容，将真实的图片和文档数据替换为纯文本占位符
    let hasMediaBlock = false
    const newContent = content.flatMap(block => {
      if (block.type === 'image') {
        hasMediaBlock = true
        return [{ type: 'text' as const, text: '[image]' }]
      }
      if (block.type === 'document') {
        hasMediaBlock = true
        return [{ type: 'text' as const, text: '[document]' }]
      }
      return [block]
    })
    // ...
  })
}
```
把图片和长文档直接替换成 `[image]` 占位符，不仅节省了巨大的开销，还保证了逻辑的连贯性。

### 2. 绝境逃生舱：PTL (Prompt Too Long) 重试

这个是我在源码里看到的最硬核的设计之一。

你想想，如果用户一次性塞入了太多巨大的文件，导致**连“发起压缩总结”这个请求本身，都超过了 API 的最大 Token 限制**怎么办？按照普通逻辑，系统直接就死锁崩溃了。

源码里专门写了一个 `truncateHeadForPTLRetry` 逃生舱函数：

```typescript
// 摘自 src/services/compact/compact.ts
export function truncateHeadForPTLRetry(
  messages: Message[],
  ptlResponse: AssistantMessage,
): Message[] | null {
  // ... (省略部分重试标记剥离逻辑)
  const groups = groupMessagesByApiRound(input)
  if (groups.length < 2) return null

  const tokenGap = getPromptTooLongTokenGap(ptlResponse)
  let dropCount: number
  
  if (tokenGap !== undefined) {
    // 如果 API 明确告诉了超出的 Token 数量，精准计算要丢弃几轮
    let acc = 0
    dropCount = 0
    for (const g of groups) {
      acc += roughTokenCountEstimationForMessages(g)
      dropCount++
      if (acc >= tokenGap) break
    }
  } else {
    // 当连压缩请求都超载，且不知道超出多少时，默认抛弃最老的 20% 历史记录
    dropCount = Math.max(1, Math.floor(groups.length * 0.2))
  }

  // 直接丢弃头部消息，保留最新内容
  const sliced = groups.slice(dropCount).flat()
  return sliced
}
```
官方注释里写得很明白：“This is the last-resort escape hatch... Dropping the oldest context is lossy but unblocks them.”（这是最后的逃生舱，丢弃最老的上下文虽然有损，但能防止对话彻底卡死）。真金白银买来的经验！

---

## 二、大道至简：基于文件系统的记忆机制

外界一直有很多猜测，觉得 Claude Code 这么聪明，肯定是偷偷连了一个强大的向量数据库（Vector DB）来管理长期记忆。

**但当我翻开 `src/memdir/memdir.ts` 的源码时，大跌眼镜。**

它根本没有什么高深莫测的数据库组件，而是极其务实地利用了**本地文件系统**，外加一段堪称教科书级别的 `System Prompt`。

### 1. 教模型做笔记：两步走法则

在系统启动时，框架会给大模型注入这样一段 Prompt，手把手教它怎么存记忆：

```typescript
// 摘自 src/memdir/memdir.ts 中的 buildMemoryLines 函数
const howToSave = [
  '## How to save memories',
  '',
  'Saving a memory is a two-step process:',
  '',
  '**Step 1** — write the memory to its own file (e.g., `user_role.md`, `feedback_testing.md`) using this frontmatter format:',
  // ... 写入带有 name, description, type 的 Markdown Frontmatter
  '',
  `**Step 2** — add a pointer to that file in \`${ENTRYPOINT_NAME}\`. \`${ENTRYPOINT_NAME}\` is an index, not a memory — each entry should be one line, under ~150 characters...`
]
```
原来，大模型是被这套规则“规训”出来的：
1. 先用常规的文件写入工具把详细记忆（比如代码规范、某个 Bug 的前因后果）写进具体的 `.md` 文件。
2. 然后再去修改 `MEMORY.md`（记忆的目录索引），在里面加一行带链接的超短描述。

### 2. 严防死守的防爆机制

因为 `MEMORY.md` 就像一本书的目录，它会被无条件塞入你的每一次对话上下文。如果模型把目录写成了流水账，Token 早就爆了。

于是源码里做了一件非常暴力的事——**强制截断加警告**：

```typescript
// 摘自 src/memdir/memdir.ts
export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200  // 强制死命令：最多 200 行
export const MAX_ENTRYPOINT_BYTES = 25_000 // 强制死命令：最多约 25KB

export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  // ...
  const reason = wasByteTruncated && !wasLineTruncated
    ? `${formatFileSize(byteCount)} (limit: ${formatFileSize(MAX_ENTRYPOINT_BYTES)}) — index entries are too long`
    : wasLineTruncated && !wasByteTruncated
      ? `${lineCount} lines (limit: ${MAX_ENTRYPOINT_LINES})`
      : `${lineCount} lines and ${formatFileSize(byteCount)}`

  return {
    // 暴力截断，并在末尾贴上大字报警告！
    content: truncated + `\n\n> WARNING: ${ENTRYPOINT_NAME} is ${reason}. Only part of it was loaded. Keep index entries to one line under ~200 chars...`,
    // ...
  }
}
```
一旦超标，系统直接从末尾一刀切，并附上大写加粗的 `> WARNING:`。大模型下次读到这句警告，自己就会吓得去精简索引文件了。这种用 Prompt 反向控制 AI 行为的设计，非常精妙。

---

## 三、分身术：AgentTool 与子代理机制

不知道你有没有想过，大模型在帮我重构某个核心模块时，万一把代码全改炸了怎么办？或者我想让它一边跑几十个单元测试，一边跟我讨论需求，它能做到吗？

答案在 `src/tools/AgentTool/AgentTool.tsx` 里。它可以派生子代理。

```typescript
// 摘自 src/tools/AgentTool/AgentTool.tsx
const fullInputSchema = lazySchema(() => {
  const multiAgentInputSchema = z.object({
    name: z.string().optional().describe('Name for the spawned agent...'),
    team_name: z.string().optional().describe('Team name for spawning...'),
    // ...
  });
  return baseInputSchema().merge(multiAgentInputSchema).extend({
    isolation: z.enum(['worktree', 'remote']).optional()
      .describe('Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.'),
    cwd: z.string().optional(),
    run_in_background: z.boolean().optional()
  });
});
```

仔细看里面的三个核心字段，这绝对是高级程序员才能想出来的骚操作：

1. **后台运行 (`run_in_background`)**：当设为 `true` 时，大模型派生出小弟后，主进程不会傻等。系统返回一个 `async_launched` 状态，大模型可以接着跟你聊天，过一会儿再去读取小弟的输出日志。
2. **绝对隔离 (`isolation: 'worktree'`)**：这是最让我惊艳的设计！当大模型需要做破坏性实验时，底层会自动调用 `git worktree add` 创建一个平行的物理克隆目录。子代理在这个沙箱里随便造，完全不会弄脏你当前的开发分支！
3. **团队协作 (`team_name` & `name`)**：主代理不仅能创建助手，还能给它起名字。在实验特性下，甚至能通过 tmux 劈开一个新面板，让两个 AI 在你面前结对编程。

---

## 四、动手实践：写一个极简的记忆管理器

看了这么多源码，是不是觉得“两步走”记忆法其实也没那么难？

光说不练假把式。今天我们就借鉴 Claude Code 的思路，用几十行 Node.js 代码，写一个能自动防爆的**极简本地记忆管理器**。

你可以把下面这段代码保存为 `MemoryManager.ts`，以后用大模型写脚本时，直接让它调用这个类来持久化经验。

```typescript
import fs from 'fs';
import path from 'path';

export class MemoryManager {
  private memDir = './.ai_memory';
  private indexPath = path.join(this.memDir, 'MEMORY.md');

  constructor() {
    // 初始化记忆目录和索引文件
    if (!fs.existsSync(this.memDir)) fs.mkdirSync(this.memDir);
    if (!fs.existsSync(this.indexPath)) {
      fs.writeFileSync(this.indexPath, '# 全局记忆索引\n\n> 注意：单条记录必须少于 100 字，总行数不可超过 10 行！\n\n');
    }
  }

  // 两步走法则的落地实现
  saveMemory(topic: string, details: string, summary: string) {
    // Step 1: 写入详情文件（大模型可以尽情长篇大论）
    const fileName = `${topic.replace(/\s+/g, '_')}.md`;
    fs.writeFileSync(path.join(this.memDir, fileName), details);

    // Step 2: 更新索引（严格限制长度）
    const indexLine = `- [${topic}](./${fileName}): ${summary.substring(0, 100)}`;
    let indexContent = fs.readFileSync(this.indexPath, 'utf-8');
    
    // 模拟源码中的防爆截断机制：超过 10 行直接抛弃最老的记忆
    const lines = indexContent.split('\n');
    if (lines.length > 10) {
      console.warn('⚠️ 警告：记忆索引过长，触发强制截断！');
      // 保留表头，截去最老的一条记录
      indexContent = lines.slice(0, 3).concat(lines.slice(4)).join('\n');
    }

    fs.writeFileSync(this.indexPath, indexContent + '\n' + indexLine);
    console.log(`✅ 记忆已保存：${topic}`);
  }
}

// 测试一下
const mem = new MemoryManager();
mem.saveMemory('Git_Bug', '今天修复了一个由 rebase 引发的惊天血案...', '千万不要在公共分支使用 rebase');
```

只要掌握了这个思想，你完全可以把它封装成 MCP 服务，给市面上所有的通用大模型加上一个不会爆 Token 的“外置海马体”。

---

## 五、小结

通过对这三大模块的源码剖析，我们发现了 Claude Code 团队非常务实的工程智慧：

- **不要幻想模型完美**：与其指望模型每次都聪明地总结，不如用硬性的 `stripImages` 和强制截断来兜底。
- **KISS 原则（Keep It Simple, Stupid）**：抛弃了花里胡哨的向量数据库，用最原始的文件系统 + 优秀的 Prompt 规训，反而做到了最好的稳定性和可读性。
- **沙箱即正义**：利用原生的 `Git Worktree` 实现代码级别的沙箱隔离，让并发试错真正有了底气。

如果你能读懂这几部分源码，你完全有能力跳出“提示词工程师”的圈子，自己写出一个真正有生命力的 Agent 框架。

---

## 六、推荐阅读

- [Git Worktree 官方文档](https://git-scm.com/docs/git-worktree) —— 强烈建议学习这个冷门但极其实用的 Git 命令，它是实现安全沙箱的核心。
- [Anthropic: Context Window Management](https://docs.anthropic.com/en/docs/managing-context-windows) —— 官方教你如何科学地管理长上下文。