# 10. mini-cc 的技能系统：给 AI 装上“专业外挂”

## 引言

今天咱们换个方向，聊聊怎么给 AI **喂点好饭**——不是硬塞工具，而是教它“怎么干活”。这顿饭就是**技能系统（Skill System）**。

说实话，刚开始琢磨这块的时候我挺纠结的：AI 怎么才能从一个“啥都能聊”的聊天机器人，变成一个能解决复杂问题的靠谱助手？单纯给它堆工具（Tool）显然不够，工具只管“做什么”，不管“怎么做”。

后来在深入学习 Claude code 源码的过程中，逐渐领悟到——**技能应该是可插拔的“能力模块”**，是教 AI 怎么做事的“说明书”，而不是单纯让 AI 去调用某个函数。也去参考了 Anthropic 发布的 [Agent Skills 开放标准](https://agentskills.io/home)。

## 技能 vs 工具：差在哪？

很多刚开始接触 AI 编程的朋友，Tool 和 Skill 傻傻分不清。我打个比方你就明白了：

- **工具（Tool）**：是一把扳手，AI 拿着它去拧螺丝。拧一下是一个独立动作，用完就放下。
- **技能（Skill）**：是 AI 背下来的一套“维修手册”。遇到问题，它先翻手册，按步骤判断：“嗯，这里得先检查电路，再换电容，最后测试”——手册一直挂在脑子里，持续影响行为。

更精准一点：Tool 是“执行者”，只负责单一功能；Skill 是“协调者”，通过编排工具实现复杂的业务逻辑。

如果把 Tool 比作食材和厨具，那 Skill 就是菜谱——光给 AI 一堆锅碗瓢盆没用，它得知道“先烧水、再下面、等三分钟关火”，才能煮出一碗面来。

业界很多文章把 Tool、Skill、Agent 分别比作“肌肉、神经系统和大脑”：Tool 提供基础执行能力，Skill 实现标准化流程控制，Agent 负责自主决策。这个比喻我觉得挺贴切。

有了技能系统，AI 就不再只是一个“会聊天的工具包”，而是一个能**持续进化**的智能助手。

接下来，我们一起看看，mini-cc 的技能系统到底长啥样，以及我是怎么一步步踩坑填坑的。

## 技能系统的核心概念

mini-cc 的技能系统，代码主要搁在 `src/skills/` 目录底下。核心组件就三个：

1. **`types.ts`**：定义了技能的接口（名字、描述、分类、Prompt、上下文等）。
2. **`SkillManager.ts`**：技能的管理中心，负责注册、加载（内置+用户自定义）和搜索。
3. **`built-in/`**：内置技能的具体实现（remember 记忆管理、simplify 代码简化、verify 代码验证）。

整个技能系统跑起来的流程大致是这样的：

```
┌─────────────────────────────────────────────────────────┐
│                    Agent 循环                            │
│                        │                                │
│                        ▼                                │
│               ┌──────────────────┐                      │
│               │   Skill Manager  │                      │
│               │   (技能管理器)    │                       │
│               └────────┬─────────┘                      │
│                        │                                │
│      ┌─────────────────┼─────────────────┐              │
│      ▼                 ▼                 ▼              │
│ ┌───────────┐   ┌───────────┐   ┌───────────┐           │
│ │ remember  │   │ simplify  │   │  verify   │           │
│ │  (记忆)    │   │  (拆解)   │   │  (验证)    │           │
│ └───────────┘   └───────────┘   └───────────┘           │ 
│      │                 │                 │              │
│      └─────────────────┼─────────────────┘              │
│                        ▼                                │
│              注入到 LLM 请求的 Prompt 中                  │
└─────────────────────────────────────────────────────────┘
```

核心思路其实很简单：**技能系统是挂在 Agent 主循环上的一道“预处理+注入”机制**。

每次用户提问之前，先把所有激活技能的 Prompt 揉在一起，塞进 LLM 的系统指令里。

LLM 根本不知道背后是谁干的，它只觉得自己“好像变聪明了”——就像你早上喝咖啡不会去想咖啡豆是哪块地种的一样。

## 核心数据结构

技能在代码里长什么样？我看看 `types.ts` 里的定义：

```typescript
// src/skills/types.ts
export interface Skill {
  name: string;           // 技能唯一标识（英文）
  displayName: string;    // 显示名称（中文，方便用户看）
  description: string;    // 技能描述
  category: SkillCategory; // 分类：memory/code/analysis/workflow/custom
  prompt: string;         // 核心提示词——这是最精华的部分！
  examples?: string[];    // 使用示例
  tags?: string[];        // 标签
}

export type SkillCategory = 
  | 'memory'      // 记忆管理
  | 'code'        // 代码相关
  | 'analysis'    // 分析相关
  | 'workflow'    // 工作流
  | 'custom';     // 自定义（给你自己发挥）
```

**注意**：真实的技能定义里，**没有 `execute` 方法**！这不是我偷懒，而是技能的本质就不是“可执行代码”——技能的核心是一段精心设计的 **Prompt**，告诉 AI 应该怎么思考和行动。

这个差异我一开始也踩过坑。

Skill 与普通 Prompt 的本质区别在于：Skill 是一份清晰、严谨、可执行的指令文档，明确告诉 AI“在什么条件下，按照哪些步骤，产出什么结果”，而不是一次性、临时性的口头交代。

## 技能管理器实现

管理器是整个技能系统的“大脑”，用了单例模式，确保全局只有一个实例。代码逻辑其实不复杂：

```typescript
// src/skills/SkillManager.ts
export class SkillManager {
  private static instance: SkillManager;
  private skills: Map<string, Skill> = new Map();
  private skillsByCategory: Map<SkillCategory, Skill[]> = new Map();
  
  // 单例模式——确保全局只有一个
  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }
  
  // 注册技能：同时按分类存储，方便后面按类别查
  public registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
    
    const categorySkills = this.skillsByCategory.get(skill.category) || [];
    categorySkills.push(skill);
    this.skillsByCategory.set(skill.category, categorySkills);
  }
  
  // 搜索技能——你想找啥，name/描述/标签/中文名都能命中
  public searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(skill => 
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.displayName.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}
```

管理器主要干三件事：
1. **注册**：把技能存进 Map，同时按分类整理好，方便后面用
2. **搜索**：支持按名称、描述、标签模糊搜索——用户说“帮我找找关于记忆的技能”，马上就能找到
3. **加载**：启动时自动加载内置技能和用户自定义技能（JSON 格式）

## 内置技能实现

mini-cc 目前内置了三个技能，都是我在实际使用中反复打磨的“实用小工具”。

Skill 的核心魅力正在于此：它不是让 AI “多一个函数能调”，而是让它 **“知道一种新的工作方法”**。

### 1. Remember 技能（记忆管理）

这个技能专门用来“记东西”。用户说“记住我们使用 TypeScript 和 React”，Agent 就会把这个信息存进长期记忆。下次再问“帮我写个组件”，Agent 就会自动用前端的思路来答。

```typescript
// src/skills/built-in/remember.ts
const rememberSkill = {
  name: 'remember',
  displayName: '记忆管理',
  description: '帮助 AI 记住重要信息，存储到项目的 .ai_memory 文件中',
  category: 'memory',
  prompt: `你是一个记忆管理助手。当用户要求你记住某些信息时，你需要：

1. 理解用户想要记住的内容
2. 将信息结构化存储到 .ai_memory 目录中
3. 使用清晰的分类（如：architecture, preferences, conventions, decisions）
4. 为每条记忆添加时间戳和描述

记忆存储方式：
- 使用两步走法则：详细内容写入独立的 .md 文件
- 在 MEMORY.md 索引文件中添加指向该文件的单行链接描述
- 每个记忆文件可以包含 frontmatter 元数据（type, description 等）

请使用 FileWriteTool 或 FileEditTool 来创建和更新记忆文件。`,
  examples: [
    '请记住：我们的项目使用 TypeScript 和 React',
    '记住我喜欢使用函数式编程风格',
    '请记录：API 基础 URL 是 https://api.example.com'
  ],
  tags: ['memory', 'persistence', 'context']
};
```

实现原理很简单：通过 prompt 告诉 AI 在什么情况下该“记笔记”，怎么提取关键信息，以及用什么格式存。

这部分 prompt 我反复改了好几版——一开始 AI 连“记住今天是周四”都往记忆里存，后来加了“只记事实性信息，不记对话细节”这条规则，才总算老实了。

Skill 的本质就是把这些“经验修正”固化下来。

### 2. Simplify 技能（代码简化）

这个技能专门用来“简化代码”。比如用户说“帮我简化 src/utils/helper.ts 中的代码”，Simplify 技能会分析代码复杂度，识别过长的函数、深层嵌套、重复代码，然后应用重构技巧进行优化。

```typescript
// src/skills/built-in/simplify.ts
const simplifySkill = {
  name: 'simplify',
  displayName: '代码简化',
  description: '简化复杂代码，提高可读性和可维护性',
  category: 'code',
  prompt: `你是一个代码重构专家。当用户要求简化代码时，你需要：

1. 分析代码复杂度
   - 识别过长的函数（超过 50 行）
   - 识别深层嵌套（超过 3 层）
   - 识别重复代码
   - 识别复杂的条件逻辑

2. 应用重构技巧
   - 提取函数：将大函数拆分为小函数
   - 提取变量：用有意义的变量名替代复杂表达式
   - 简化条件：使用早返回、卫语句
   - 消除重复：提取公共逻辑
   - 使用现代语法：箭头函数、解构、可选链等

3. 保持功能不变
   - 确保重构后的代码行为与原代码一致
   - 建议运行测试验证

4. 提供对比
   - 展示重构前后的代码对比
   - 解释改进的原因
   - 说明可读性和可维护性的提升

请使用 FileReadTool 读取代码，使用 FileEditTool 进行重构。`,
  examples: [
    '请简化 src/utils/helper.ts 中的代码',
    '重构这个函数，让它更容易理解',
    '这段代码太复杂了，帮我优化一下'
  ],
  tags: ['refactoring', 'code-quality', 'readability', 'maintainability']
};
```

这里的设计思路是：**用 prompt 引导 AI 建立结构化的重构思维**，而不是靠代码逻辑来“硬编码”简化方法。

这样做的好处是灵活——今天优化前端代码，明天优化后端逻辑，AI 都能用同样的结构化思路去处理，只要 prompt 写得够好就行。

### 3. Verify 技能（代码验证）

这个技能用来“检查代码质量”。比如用户说“检查 src 目录下的代码是否有问题”，Verify 技能会按顺序执行编译检查、Linter 检查、测试检查，并生成详细报告。

```typescript
// src/skills/built-in/verify.ts
const verifySkill = {
  name: 'verify',
  displayName: '代码验证',
  description: '验证代码质量，检查类型错误、linter 问题、测试覆盖率等',
  category: 'code',
  prompt: `你是一个代码质量验证助手。当用户要求验证代码时，你需要：

1. 编译检查
   - 运行 TypeScript 编译器检查类型错误
   - 使用 BashTool 执行: npm run build 或 tsc --noEmit

2. Linter 检查
   - 运行 ESLint 检查代码规范
   - 使用 BashTool 执行: npm run lint 或 eslint .

3. 测试检查
   - 运行测试套件
   - 使用 BashTool 执行: npm test

4. 代码审查
   - 使用 GrepTool 搜索常见问题模式：
     * console.log（生产代码中的调试语句）
     * TODO/FIXME（未完成的工作）
     * any 类型（TypeScript 类型安全问题）
     * 硬编码的密钥或敏感信息

5. 生成报告
   - 总结发现的问题
   - 按严重程度分类
   - 提供修复建议

请按顺序执行这些检查，并生成详细的验证报告。`,
  examples: [
    '请验证当前项目的代码质量',
    '检查 src 目录下的代码是否有问题',
    '运行完整的代码验证流程'
  ],
  tags: ['code-quality', 'testing', 'linting', 'verification']
};
```

这个技能的逻辑是：让 AI 扮演“代码审查员”的角色，按照既定流程检查代码质量。

它会调用多种工具（BashTool、GrepTool）来执行不同的检查任务，然后汇总成一份详细的报告。

这是一个很实用的开发辅助功能，帮助开发者在提交代码前确保代码质量。

## 技能与 Agent 的集成

技能是怎么跟 Agent 主循环捏合在一起的呢？核心逻辑概括起来就是：**把技能的 prompt 合并成 LLM 的系统指令**。

```typescript
// 技能集成的核心逻辑
async function runSkillSystem(userInput: string): Promise<string> {
  const skillManager = SkillManager.getInstance();
  
  // 1. 拿到所有启用的技能
  const enabledSkills = skillManager.getAllSkills();
  
  // 2. 把所有技能的 prompt 拼成一段超级“工作手册”
  const skillPrompts = enabledSkills.map(skill => {
    return `【${skill.displayName}】\n${skill.prompt}`;
  }).join('\n\n');
  
  // 3. 注入到 LLM 的系统 Prompt 里
  const messages = [
    { role: 'system', content: `你是 mini-cc 智能助手，拥有以下专业能力：\n\n${skillPrompts}` },
    { role: 'user', content: userInput }
  ];
  
  // 4. 调用 LLM
  const response = await provider.chat(messages);
  
  return response.content;
}
```

技能系统被挂在 Agent 循环的**最前端**。

用户说的话进来之后，先把所有激活技能的 prompt 合并成一段系统提示，然后传给 LLM。

AI 只知道自己接收到了一个“优化过”的输入，并不知道背后是谁干的。这就是“给 AI 喂饭”的精髓——**悄无声息地帮 AI 把问题变得更容易解决**。

## 技能管理命令

mini-cc 提供了一组跟技能交互的终端命令，方便你实时查看和管理：

```typescript
// 显示所有可用技能
export function showSkillList(): string {
  const skillManager = SkillManager.getInstance();
  const allSkills = skillManager.getAllSkills();
  const stats = skillManager.getStats();

  let output = '\n🎯 技能系统\n\n';
  output += `共有 ${stats.total} 个技能可用\n\n`;

  // 按分类显示技能
  const categories = {
    memory: '📝 记忆管理',
    code: '💻 代码相关',
    analysis: '🔍 分析相关',
    workflow: '⚙️ 工作流',
    custom: '🎨 自定义',
  };

  for (const [category, label] of Object.entries(categories)) {
    const skills = skillManager.getSkillsByCategory(category as any);
    if (skills.length > 0) {
      output += `${label}\n`;
      skills.forEach(skill => {
        output += `  • ${skill.name} - ${skill.displayName}\n`;
        output += `    ${skill.description}\n`;
      });
    }
  }
  return output;
}

// 搜索技能
export function searchSkills(query: string): string {
  const skillManager = SkillManager.getInstance();
  const results = skillManager.searchSkills(query);

  if (results.length === 0) {
    return `未找到匹配的技能: "${query}"`;
  }

  let output = `找到 ${results.length} 个技能：\n\n`;
  results.forEach(skill => {
    output += `• ${skill.name} - ${skill.displayName}\n`;
    output += `  ${skill.description}\n`;
  });
  return output;
}
```

对应的命令格式：
- `/skill`：显示所有可用技能（按分类列出）
- `/skill <name>`：激活指定技能
- `/skill search <query>`：搜索跟关键词相关的技能

## 自定义技能

mini-cc 支持**用户自己写技能**。你可以在用户级目录下放一个 JSON 文件，一个自定义技能就诞生了。

```json
// ~/.mini-cc/skills/translate.json
{
  "name": "translate",
  "displayName": "翻译助手",
  "description": "将中文翻译成英文，或英文翻译成中文",
  "category": "workflow",
  "prompt": `你现在拥有翻译能力。请按照以下规则进行翻译：

  1. 识别用户输入的语言
  2. 如果是中文，翻译成英文；如果是英文，翻译成中文
  3. 保持原文的语气和风格
  4. 对于技术术语，使用标准翻译

  翻译示例：
  中文：这是一个测试
  英文：This is a test

  英文：Hello World
  中文：你好世界`,
  "examples": [
    "翻译：你好世界",
    "Translate: Hello World",
    "帮我翻译这段话"
  ],
  "tags": ["翻译", "语言", "国际化"]
}
```

配置好之后重启 mini-cc，这个翻译技能就会自动加载，AI 就会拥有“翻译助手”的能力。

## 总结

技能系统是 mini-cc 里一个低调但挺重要的组件：

1. **三个内置技能**：remember 记忆管理、simplify 代码简化、verify 代码验证
2. **自定义技能支持**：JSON 文件就能写，门槛不高
3. **按分类组织**：支持搜索，方便管理
4. **无缝集成**：技能自动挂在 Agent 主循环上，用户基本无感知

**核心设计理念其实就一句话：技能不是让 AI“多一个函数可调用”，而是让 AI“多一种做事的方法”。**

这就是 Anthropic 开源 Agent Skills 标准的思路：与其给每个领域造一个专用 AI，不如造一个通用 Agent，再挂上可插拔的能力模块。

---

P.S. 技能系统虽然现在还比较简单，但方向是对的。

2025 年底，Anthropic 把 Agent Skills 发布为开放标准后，2026 年这套规范已经被多家主流云服务商采纳，形成了覆盖 3000+ 社区技能的生态。Gartner 预测，2026 年 75% 的 AI 项目将聚焦于可组合的 Skills 而非单体 Agent——AI 开发正在从“手工作坊”向“工业化组装”转型。

我下一步计划是让 mini-cc 的技能系统继续迭代，让技能能跟 Claude、Cursor 等工具互认互用。毕竟，给 AI 造一个“统一的充电接口”，才是更长远的目标。

源码地址：https://github.com/you-want/mini-cc

技能系统相关的代码主要在这几个文件里：
- `src/skills/types.ts`：技能接口定义
- `src/skills/SkillManager.ts`：管理器实现（单例模式）
- `src/skills/built-in/`：内置技能的具体实现

欢迎围观，也欢迎提 PR 加新技能！顺便求个 ⭐Star，救救孩子😭

---
