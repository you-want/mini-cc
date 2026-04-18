# mini-cc 进阶功能实现教程 (致敬业界优秀源码)

在这篇教程中，我们将根据一些业界优秀 AI Code Agent 的源码分析文章（如 `/docs` 目录下的内容），在我们的 `mini-cc` 中一步步复刻它的几个**杀手级进阶特性**！

通过这篇教程，你将了解 AI Agent 的工程化细节是如何做到极致的。

---

## 🚀 1. 架构层：Fast-path 快速入口 (对应 01-architecture.md)

**痛点**：对于一个 CLI 工具，如果用户只是想看一下版本号 `mini-cc --version`，结果程序还要慢吞吞地去初始化环境变量、加载大模型客户端，体验会非常差。
**实现**：我们需要在入口文件的最顶端（任何大模块被加载之前）拦截特定参数。

**代码实现**：
在 `src/index.ts` 的最顶部加入这段极速通道代码：
```typescript
// 处理 Fast-path：极速通道
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  console.log('mini-cc v1.0.0 (Fast-path)');
  process.exit(0); // 直接退出，绝不拖泥带水！
}
```

---

## 🛡️ 2. 安全层：Bash 命令安全沙盒 (对应 09-security-and-sandbox.md)

**痛点**：赋予 AI 执行 Bash 命令的权限非常危险。如果模型“抽风”或者被恶意提示词越权，执行了 `rm -rf /`，整个系统就会崩溃。
**实现**：我们需要在 `BashTool` 中加入一道防火墙，拦截高危指令和隐蔽的命令替换语法。

**代码实现**：
1. 创建 `src/tools/BashTool/bashSecurity.ts`，定义拦截规则：
```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-r[fF]?\s+\//,         // 严禁删根目录
  /mkfs\./,                    // 严禁格式化
];
const COMMAND_SUBSTITUTION_PATTERNS = [
  /\$\([^)]+\)/,  // 拦截 $(...)
  /`[^`]+`/,      // 拦截 `...`
];

export function checkCommandSecurity(command: string) {
  // 遍历正则拦截...
  return { isSafe: false, reason: '包含高危指令模式' };
}
```

2. 在 `src/tools/BashTool.ts` 执行前拦截它：
```typescript
const securityCheck = checkCommandSecurity(command);
if (!securityCheck.isSafe) {
  console.warn(`[BashTool 安全拦截] 拒绝执行: ${command}`);
  // 注意：要返回给大模型让它知道被拒绝了，而不是直接抛错崩溃
  return `命令执行被安全沙盒拒绝：${securityCheck.reason}，请换种方式。`;
}
```

---

## 🗜️ 3. 引擎层：上下文瘦身术 Microcompact (对应 02-query-engine.md)

**痛点**：有时候工具返回的结果太长（例如 `cat bundle.js` 返回了几万行），这不仅会导致大模型 API 报错 Token 超限，还会消耗巨额的费用。
**实现**：在 Agent 处理工具返回结果时，加上强制截断逻辑（微型压缩）。

**代码实现**：
在 `src/core/Agent.ts` 的工具执行结果处添加保护：
```typescript
let result = await tool.execute(call.args);

// 【上下文瘦身术】
if (typeof result === 'string' && result.length > 8000) {
  console.warn(`[上下文瘦身] 返回结果过长，触发 microcompact 截断。`);
  result = result.substring(0, 8000) + '\n\n...[内容过长，已被截断]...';
}
```
这样一来，模型既能知道文件的大致内容，又不会被巨量 Token 撑爆。

---

## 🦆 4. 彩蛋层：电子宠物系统与 Mulberry32 (对应 08-buddy-easter-egg.md)

**亮点**：官方源码里藏了一个电子宠物系统，为了保证每次打开终端宠物形态固定，他们手写了 `Mulberry32` 伪随机数算法。
**实现**：我们也在 `mini-cc` 中实现这个浪漫的彩蛋！

**代码实现**：
1. 创建 `src/buddy/companion.ts`：
```typescript
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function spawnBuddy(seedInput?: string) {
  // 利用时间或输入作为随机数种子...
  console.log(`🐾 宠物: 🦆 小黄鸭 (Duck)`);
  console.log(`🎭 性格: 喜欢熬夜`);
}
```

2. 在 `src/index.ts` 中拦截 `/buddy` 指令：
```typescript
if (input.toLowerCase() === '/buddy') {
  spawnBuddy();
  rl.prompt();
  return;
}
```

## 总结

现在，我们的 `mini-cc` 已经具备了快速启动、安全沙盒、智能上下文截断以及有趣的彩蛋系统！这些小细节正是区分一个“玩具 Demo”和“工业级 CLI 工具”的关键所在。