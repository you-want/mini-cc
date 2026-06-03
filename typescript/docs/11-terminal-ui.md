## 11. mini-cc 终端 UI：用 React 写 CLI 是什么体验

### 引言

上一篇文章聊了技能系统，今天咱们换个画风，看看 mini-cc 的"脸面"——终端 UI。

说句掏心窝子的话，最开始我根本没打算在终端 UI 上花什么心思。传统 CLI 嘛，不就是 print 几行字、读个输入，完事了。

后来用着用着发现不对劲：对话一长，满屏滚动的文本看得眼晕；想找个历史消息得全靠翻；工具调用进度完全靠猜……这体验，怎么看都不像一个"AI Agent"该有的样子。

看 Claude Code 的终端 UI，我决定也用 React 写一个终端 UI。

**Ink**——一个让你用 React 组件写命令行界面的框架。当时看到这个项目第一反应是："啊？还能这样？"试了一下，就真香了。

今天这篇文章，我就想聊聊 mini-cc 的终端 UI 是怎么用 Ink + React 搭起来的。

### 为什么用 React 写 CLI

先说说传统 CLI 工具有多"反人类"。

你要做一个带输入框、消息列表、实时进度条的终端界面，传统做法基本是这样的：

- 手动处理光标移动和 ANSI 转义序列————30 年前的打印纸条技术
- 手写布局逻辑——窗口尺寸变了就崩
- 状态管理靠自己——没有响应式一说，全是面条式代码

这感觉就像你在用汇编语言写一个电商网站——能跑，但谁写谁崩溃。

而 Ink 彻底改变了这个局面。它将 React 的组件化架构引入终端，开发者可以用熟悉的 JSX 语法、Hooks 模式，在命令行里构建交互式应用。

更绝的是，Ink 底层用了 Facebook 开源的 Yoga 布局引擎，在终端里实现了 Flexbox 布局——你没看错，终端里写 Flex！

一个简单的例子就能说明问题：

```typescript
import React from 'react';
import { render, Text, Box } from 'ink';

const App = () => (
  <Box flexDirection="column" padding={2}>
    <Text color="green">Hello, mini-cc!</Text>
    <Text color="gray">Welcome to the AI coding assistant</Text>
  </Box>
);

render(<App />);
```

这段代码跑起来就是一个漂亮的欢迎界面。你不需要知道终端的光标在哪儿、ANSI 转义码怎么写——Ink 帮你全包了。

### mini-cc 的 UI 架构

mini-cc 的终端 UI 分成了几个核心组件，各司其职。整个 UI 基于 Ink 框架，用 React 的方式来组织。

```
┌─────────────────────────────────────────────────────────────┐
│                   App.tsx (主应用组件)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WelcomeBanner (欢迎横幅)                 │   │
│  │              使用 Static 组件固定在顶部                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           VirtualMessageList (虚拟消息列表)            │   │
│  │           只渲染最新的 15 条消息                        │   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          CommandSuggestions (命令补全建议)             │   │
│  │          输入 / 时自动显示可用命令                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TextInput (聊天输入框)                    │   │
│  │              集成在 App.tsx 中                         │  │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

整个 UI 就是一个 App 组件，里面挂几个子组件：顶部用 `Static` 组件固定，WelcomeBanner（只会渲染一次然后自然滚出屏幕），中间 VirtualMessageList 滚消息，底部是输入框和命令补全建议。

### 核心组件实现

下面我把每个核心组件的代码贴出来，顺便讲讲踩过的坑。

#### 1. App——老大哥

App 组件是整个终端 UI 的入口，管理所有状态和交互逻辑。

```typescript
// src/components/App.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useInput, Static } from 'ink';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import TextInput from 'ink-text-input';
import { VirtualMessageList } from './VirtualMessageList';
import { WelcomeBanner } from './WelcomeBanner';
import { CommandSuggestions, CommandSuggestion } from './CommandSuggestions';
import { CommandCompletionManager } from '../commands/CommandCompletionManager';

interface AppProps {
  agent: any;
  onExit: () => void;
  onClear: () => void;
  onSwitchProvider: (provider: any) => void;
  initialInput?: string;
}

export function App({ agent, onExit, onClear, onSwitchProvider, initialInput = '' }: AppProps) {
  const [messages, setMessages] = useState<Array<{ id: string; content: string }>>([]);
  const [welcome] = useState([{ id: 'welcome-banner' }]);
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  
  // 命令补全状态
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  
  // 语音模式状态
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const abortRef = useRef<AbortController | null>(null);
  const completionManagerRef = useRef<CommandCompletionManager | null>(null);

  // 初始化命令补全管理器
  useEffect(() => {
    completionManagerRef.current = CommandCompletionManager.getInstance();
  }, []);

  // 处理命令补全的键盘导航
  useInput((inputChar, key) => {
    if (!showSuggestions || isLoading || isVoiceMode) return;

    if (key.upArrow) {
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (key.downArrow) {
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (key.tab) {
      // Tab 补全选中的命令
      if (suggestions.length > 0) {
        const selected = suggestions[selectedSuggestionIndex];
        setInput(selected.fullCommand || selected.command);
        setShowSuggestions(false);
      }
    } else if (key.escape) {
      setShowSuggestions(false);
    }
  }, { isActive: showSuggestions && !isLoading && !isVoiceMode });

  // 监听输入变化，更新命令补全建议
  useEffect(() => {
    if (!completionManagerRef.current) return;

    const trimmedInput = input.trim();
    
    if (trimmedInput.startsWith('/') && !isLoading && !isVoiceMode) {
      const newSuggestions = completionManagerRef.current.getAllSuggestions(trimmedInput);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, isLoading, isVoiceMode]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    // 处理 / 开头的命令
    if (query.trim().startsWith('/')) {
      const { interceptCommand } = require('../commands/CommandInterceptor');
      const result = await interceptCommand(query.trim());
      
      if (result.intercepted && result.output) {
        setMessages(prev => [...prev, { id: `cmd-${Date.now()}`, content: result.output }]);
        setInput('');
        return;
      }
    }

    // 用户消息
    const userMsg = { id: `user-${Date.now()}`, content: `[You]: ${query}` };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // AI 消息（流式更新）
    const aiMsgId = `ai-${Date.now() + 1}`;
    setMessages(prev => [...prev, { id: aiMsgId, content: `[mini-cc]: ` }]);

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;
      
      await agent.chat(query, (textChunk: string) => {
        if (abortController.signal.aborted) return;
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.id === aiMsgId) {
            lastMsg.content += textChunk;
          }
          return newMsgs;
        });
      }, abortController.signal);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* 静态 Welcome Banner，只会打印一次 */}
      <Static items={welcome}>
        {(item) => <WelcomeBanner key={item.id} />}
      </Static>

      {/* 虚拟滚动的消息列表 */}
      <Box flexDirection="column" width="100%">
        <VirtualMessageList messages={messages} columns={80} />
      </Box>

      {/* 命令补全建议 */}
      <CommandSuggestions
        suggestions={suggestions}
        selectedIndex={selectedSuggestionIndex}
        visible={showSuggestions}
      />

      {/* 底部输入框 */}
      <Box flexDirection="column" marginTop={1}>
        <Box borderStyle="round" borderColor="dim" paddingX={1} width="100%">
          <Box marginRight={1}>
            <Text color="cyan">{'>'}</Text>
          </Box>
          {isLoading ? (
            <Text color="yellow">正在思考...</Text>
          ) : isVoiceMode ? (
            <Text color={isRecording ? "red" : "gray"}>
              {isRecording ? "录音中..." : "按住 Space 开始说话"}
            </Text>
          ) : (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Ask anything..."
            />
          )}
        </Box>
        
        {/* 底部提示 */}
        <Box paddingX={1} marginTop={0}>
          <Text color="dim">$/! shell mode • / command mode • ↵ or Ctrl+J new line</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

App 组件管理整个应用的状态：消息列表、加载状态、用户输入、命令补全、语音模式。这里有几个值得注意的点：

1. **`useInput` Hook**：Ink 提供的这个 Hook 专门用来处理键盘输入，比直接监听 `process.stdin` 方便多了。我用它来处理命令补全的上下箭头导航和 Tab 补全。

2. **`Static` 组件**：WelcomeBanner 用 `Static` 包裹，确保它只渲染一次然后自然滚出屏幕，不会随着消息列表更新而重复渲染。

3. **流式输出**：AI 回答是流式更新的，每收到一个 token 就追加到消息内容里，实现打字机效果。

4. **AbortController**：用户按 Esc 可以中断正在进行的 AI 请求，避免卡住。

#### 2. WelcomeBanner——给个面子

WelcomeBanner 是一个双栏布局的欢迎界面，左侧显示 logo 和基本信息，右侧显示公告和提示。

```typescript
// src/components/WelcomeBanner.tsx
import React from 'react';
import * as os from 'os';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import * as configManager from '../utils/configManager';

export function WelcomeBanner() {
  const userName = os.userInfo().username || process.env.USER || 'developer';
  const modelName = process.env.MODEL_NAME || configManager.getConfigValue('MODEL_NAME') || 'qwen3.6-plus';
  const cwd = process.cwd();
  const homedir = os.homedir();
  const displayCwd = cwd.startsWith(homedir) ? `~${cwd.slice(homedir.length)}` : cwd;
  
  const provider = process.env.PROVIDER || configManager.getConfigValue('PROVIDER') || 'openai';
  const providerDisplay = provider === 'openai' ? 'OpenAI / Compatible' : 'Anthropic';
  
  let version = '1.0.0';
  try {
    const pkg = require('../../package.json');
    version = pkg.version || '1.0.0';
  } catch (e) {}

  return (
    <Box borderStyle="round" borderColor="#CCFF00" paddingX={2} paddingY={1} width="100%" flexDirection="row">
      {/* 左侧区域 */}
      <Box width="50%" flexDirection="column">
        <Text color="cyan" bold>mini-cc CLI {version}</Text>
        
        {/* ASCII art logo */}
        <Box marginTop={0} marginBottom={0} flexDirection="column">
          <Text color="#CCFF00">▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505" color="#CCFF00">               </Text>█</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505">  <Text color="#CCFF00" bold>cc</Text>       <Text color="#E5E5E5">■</Text>   </Text>█</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505" color="#CCFF00">               </Text>█</Text>
          <Text color="#CCFF00">▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀</Text>
        </Box>
        
        <Text>Welcome back, <Text color="cyan">{userName}</Text></Text>
        <Text>Model: <Text color="cyan">{modelName}</Text></Text>
        <Text>Provider: <Text color="cyan">{providerDisplay}</Text></Text>
        <Text color="gray">{displayCwd}</Text>
      </Box>

      {/* 右侧区域 */}
      <Box width="50%" flexDirection="column" paddingLeft={3}>
        <Text color="cyan" bold>Announcements</Text>
        <Text>Try MINI-CC</Text>
        <Text>Website: <Text color="blue" underline>https://mini-cc.raingpt.top/</Text></Text>
        <Text>Github: <Text color="blue" underline>https://github.com/you-want/mini-cc</Text></Text>
        
        <Box marginTop={1} marginBottom={1}>
          <Text color="gray">──────────────────────────────────</Text>
        </Box>
        
        <Text color="cyan" bold>Did you know?</Text>
        <Text>You can use <Text color="yellow">/buddy</Text> to summon a digital pet!</Text>
        <Text>Type <Text color="yellow">/voice</Text> for voice mode interaction.</Text>
      </Box>
    </Box>
  );
}
```

这个组件展示了 Ink 的 Flexbox 能力：`flexDirection="row"` 实现左右双栏布局，`width="50%"` 各占一半宽度。ASCII art logo 用嵌套的 `Text` 组件实现背景色和前景色的组合效果。

#### 3. VirtualMessageList——会滚的消息列表

消息列表用了虚拟滚动技术，只渲染最新的 15 条消息，避免长对话时终端渲染溢出。

```typescript
// src/components/VirtualMessageList.tsx
import React, { useRef } from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

function useVirtualScroll(scrollRef: any, keys: string[], columns: number) {
  const count = keys.length;
  const limit = 15;
  const start = Math.max(0, count - limit);
  return {
    range: [start, count],
    topSpacer: 0,
    bottomSpacer: 0
  };
}

function VirtualItem({ msg }: { msg: { id: string; content: string } }) {
  const isUser = msg.content.startsWith('[You]');
  const isError = msg.content.startsWith('[网络错误]');
  const isSys = msg.content.startsWith('[系统') || msg.content.startsWith('✓') || msg.content.startsWith('🐾');

  return (
    <Box flexDirection="row">
      {isError ? (
        <Text color="red">{msg.content}</Text>
      ) : isUser ? (
        <Text color="cyan">{msg.content}</Text>
      ) : isSys ? (
        <Text color="yellow">{msg.content}</Text>
      ) : (
        <Text>{msg.content}</Text>
      )}
    </Box>
  );
}

export function VirtualMessageList({ messages, columns }: { messages: Array<{id: string, content: string}>, columns: number }) {
  const scrollRef = useRef(null);
  const keys = messages.map(m => m.id);
  
  const { range } = useVirtualScroll(scrollRef, keys, columns);
  const [start, end] = range;

  return (
    <Box flexDirection="column">
      {messages.slice(start, end).map(msg => (
        <VirtualItem key={msg.id} msg={msg} />
      ))}
    </Box>
  );
}
```

虚拟滚动的核心思路很简单：只渲染视口内的消息。这里为了简化，固定渲染最新的 15 条。真实场景下可以根据终端高度动态计算。

#### 4. CommandSuggestions——命令补全

输入 `/` 开头的内容时，会自动弹出命令补全建议，支持上下箭头选择和 Tab 补全。

```typescript
// src/components/CommandSuggestions.tsx
import React from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'skill' | 'system' | 'custom';
  fullCommand?: string;
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  selectedIndex: number;
  visible: boolean;
}

export function CommandSuggestions({ suggestions, selectedIndex, visible }: CommandSuggestionsProps) {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  const categoryColors: Record<string, string> = {
    skill: 'cyan',
    system: 'yellow',
    custom: 'magenta',
  };

  const categoryLabels: Record<string, string> = {
    skill: '技能',
    system: '系统',
    custom: '自定义',
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>可用命令 (↑↓ 选择, Tab/Enter 确认, Esc 取消)</Text>
      </Box>
      {suggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        
        return (
          <Box key={suggestion.command}>
            <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
              {isSelected ? '> ' : '  '}
              <Text color={categoryColors[suggestion.category]}>
                [{categoryLabels[suggestion.category]}]
              </Text>
              {' '}
              {suggestion.command}
              {' - '}
              <Text color="gray">{suggestion.description}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
```

这个组件让用户在输入命令时有清晰的引导，不用记住所有命令的拼写。选中项用绿色高亮，不同分类用不同颜色区分。

### 进度条组件

mini-cc 还内置了一个进度条组件，用于展示扫描进度等任务。

```typescript
// src/components/ProgressBar.tsx
import React, { useState, useEffect } from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

export function ProgressBar({ total }: { total: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (current >= total) return;
    const timer = setTimeout(() => setCurrent(c => c + 1), 50);
    return () => clearTimeout(timer);
  }, [current, total]);

  const percentage = Math.round((current / total) * 100);
  const filled = '█'.repeat(Math.floor(percentage / 10));
  const empty = '░'.repeat(10 - Math.floor(percentage / 10));

  return (
    <Box flexDirection="row">
      <Box marginRight={1}>
        <Text color="green">扫描进度:</Text>
      </Box>
      <Text>{filled}</Text>
      <Text color="gray">{empty}</Text>
      <Box marginLeft={1}>
        <Text>{percentage}%</Text>
      </Box>
    </Box>
  );
}
```

用 `█` 和 `░` 字符模拟进度条填充效果，配合 `useEffect` 实现自动递增。这就是 Yoga 布局引擎的威力——直接用 Flexbox 属性布局。

### 交互模式

UI 只是外壳，真正好用还得靠交互。mini-cc 的交互主要分两块：命令系统和键盘快捷键。

#### 1. 命令系统——/ 开头，你懂的

命令拦截器放在 Agent 主循环之前，用户输入 `/` 开头的内容不走 LLM 流程，直接走命令处理逻辑。

```typescript
// src/commands/CommandInterceptor.ts
export async function interceptCommand(input: string): Promise<InterceptResult> {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return { intercepted: false };
  }
  
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (command) {
    case 'provider':
      return await handleProviderCommand(args);
    
    case 'skill':
      return handleSkillCommand(args);

    case 'allow':
      return handleAllowCommand(args);

    case 'deny':
      return handleDenyCommand(args);

    case 'permissions':
      return handlePermissionsCommand();
    
    case 'buddy':
      return handleBuddyCommand(args);
    
    case 'voice':
      return await handleVoiceCommand();
    
    case 'clear':
      return handleClearCommand();
    
    case 'help':
      return handleHelpCommand();
    
    default:
      return {
        intercepted: true,
        output: `❌ 未知命令: /${command}\n输入 /help 查看可用命令`,
      };
  }
}

function handleHelpCommand(): InterceptResult {
  const output = '\n📖 可用命令\n\n' +
    'Provider 管理：\n' +
    '  /provider              - 查看当前 Provider 和可用列表\n' +
    '  /provider <name>       - 切换 Provider（全局）\n' +
    '  /provider <name> -s    - 切换 Provider（仅当前会话）\n\n' +
    
    '技能系统：\n' +
    '  /skill                 - 查看所有可用技能\n' +
    '  /skill <name>          - 使用指定技能\n' +
    '  /skill search <query>  - 搜索技能\n\n' +

    '权限系统：\n' +
    '  /allow <ToolName>      - 预审批敏感工具（当前会话）\n' +
    '  /deny <ToolName>       - 禁止工具（当前会话）\n' +
    '  /permissions           - 查看权限状态\n\n' +
    
    '趣味功能：\n' +
    '  /buddy [seed]          - 召唤数字伙伴\n' +
    '  /voice                 - 语音模式（模拟）\n\n' +
    
    '其他：\n' +
    '  /clear                 - 清空对话\n' +
    '  /help                  - 显示此帮助信息\n';
  
  return { intercepted: true, output };
}
```

mini-cc 支持的命令比一般的 CLI 工具丰富得多：

- `/provider`：查看和切换 LLM Provider
- `/skill`：技能系统管理
- `/allow` / `/deny` / `/permissions`：工具权限管理
- `/buddy`：召唤数字伙伴（彩蛋）
- `/voice`：语音模式
- `/clear` / `/help`：常规命令

#### 2. 键盘快捷键——手不离键盘

```typescript
// 在 App.tsx 中处理全局快捷键
useInput((inputChar, key) => {
  // Esc 中断当前请求
  if (isLoading && key.escape) {
    abortRef.current?.abort();
    setIsLoading(false);
    setMessages(prev => [
      ...prev,
      { id: `abort-${Date.now()}`, content: '[系统]: 已中断当前请求' }
    ]);
    return;
  }

  // Ctrl+C 退出程序
  if (!isLoading && (inputChar === 'c' && key.ctrl)) {
    onExit();
  }
});
```

`Esc` 中断请求这块我专门做了一版——AI 思考时间太长，用户按 Esc 直接终止。这避免了 AI 想超时卡住进程的情况。

### 总结

**终端 UI 的核心其实是三个字：不折腾。**

1. **基于 Ink + React**：组件化开发，声明式 UI，告别 ANSI 转义
2. **响应式布局**：Flexbox 自动适配终端尺寸变化
3. **交互友好**：命令补全 + 键盘快捷键 + 流式输出 + 中断机制

用了 React 写 CLI 之后，我的一个感慨是：**技术选型决定了开发体验的上限。** 找个趁手的工具，比造轮子划算多了。

P.S. 写 UI 这些组件的时候，我把 mini-cc 的功能也丰富了一把——命令补全建议、虚拟消息列表、语音模式模拟、数字伙伴彩蛋。

源码地址：https://github.com/you-want/mini-cc

终端 UI 相关的代码主要在这几个文件里：
- `src/components/App.tsx`：主应用入口
- `src/components/WelcomeBanner.tsx`：欢迎横幅（双栏布局 + ASCII art）
- `src/components/VirtualMessageList.tsx`：虚拟消息列表
- `src/components/CommandSuggestions.tsx`：命令补全建议
- `src/components/ProgressBar.tsx`：进度条
- `src/commands/CommandInterceptor.ts`：命令拦截与处理

欢迎围观，也欢迎提 PR 让终端 UI 更炫酷！顺便求个 ⭐Star，写 UI 真的比写逻辑累多了😭

---
