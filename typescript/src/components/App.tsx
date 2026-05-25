import React, { useState, useRef, useEffect } from 'react';
import { useInput, Static } from 'ink';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import TextInputModule from 'ink-text-input';
import { VirtualMessageList } from './VirtualMessageList';
import { WelcomeBanner } from './WelcomeBanner';
import { CommandSuggestions, CommandSuggestion } from './CommandSuggestions';
import { globalAppState } from '../infrastructure/state/AppStateStore';
import { CommandCompletionManager } from '../commands/CommandCompletionManager';


// 兼容 Bun 打包后的 CommonJS 导出格式
const TextInput = typeof TextInputModule === 'function' ? TextInputModule : (TextInputModule as any).default;

interface AppProps {
  agent: any;
  onExit: () => void;
  onClear: () => void;
  onSwitchProvider: (provider: any) => void;
  initialInput?: string;
}

export function App({ agent, onExit, onClear, onSwitchProvider, initialInput = '' }: AppProps) {
  // 我们将默认的欢迎语移除，因为现在有了炫酷的顶部 WelcomeBanner
  const [messages, setMessages] = useState<Array<{ id: string; content: string }>>([]);
  const [welcome] = useState([{ id: 'welcome-banner' }]);
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSkillName, setActiveSkillName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 命令补全状态
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const completionManagerRef = useRef<CommandCompletionManager | null>(null);

  // 语音模式状态
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDots, setRecordingDots] = useState('');
  const releaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (suggestions.length > 0) {
        const selected = suggestions[selectedSuggestionIndex];
        setInput(selected.fullCommand || selected.command);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(0);
      }
    } else if (key.return) {
      if (suggestions.length > 0) {
        const selected = suggestions[selectedSuggestionIndex];
        const selectedCommand = selected.fullCommand || selected.command;
        
        setShowSuggestions(false);
        setSelectedSuggestionIndex(0);
        setInput('');
        
        handleSubmit(selectedCommand);
      }
    } else if (key.escape) {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(0);
    }
  }, { isActive: showSuggestions && !isLoading && !isVoiceMode });

  // 处理语音模式按键
  useInput((inputChar, key) => {
    if (!isVoiceMode) return;

    if (inputChar === ' ') {
      // 拦截空格输入，避免被底层的 TextInput 捕获并显示出来
      // 因为 ink-text-input 即使我们在外部组件控制，也可能已经接收到了输入
      if (!isRecording) {
        setIsRecording(true);
        setRecordingDots('.');
      } else {
        setRecordingDots(prev => prev.length < 5 ? prev + '.' : '.');
      }

      if (releaseTimeoutRef.current) {
        clearTimeout(releaseTimeoutRef.current);
      }

      // 如果 500ms 内没有新的空格输入，认为松开了空格键
      releaseTimeoutRef.current = setTimeout(() => {
        setIsRecording(false);
        setIsVoiceMode(false);
        
        // 模拟几种不同的随机语音识别结果
        const mockVoiceTexts = [
          "帮我看看这个项目的结构是怎样的？",
          "请帮我写一个快速排序的 TypeScript 实现。",
          "有没有什么办法能优化这段代码的性能？",
          "你能帮我总结一下最近修改了哪些文件吗？"
        ];
        const randomText = mockVoiceTexts[Math.floor(Math.random() * mockVoiceTexts.length)];
        
        // 不直接发送，而是填充到输入框中，让用户确认后再发送
        // 确保清除输入框中可能存在的残留空格
        setInput(`（语音输入）${randomText}`);
      }, 500);
    } else if (key.return) {
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      setIsVoiceMode(false);
      setIsRecording(false);
    } else if (key.escape || (inputChar === 'c' && key.ctrl)) {
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      setIsVoiceMode(false);
      setIsRecording(false);
      if (inputChar === 'c' && key.ctrl) {
        onExit();
      }
    }
  }, { isActive: isVoiceMode });

  useInput((inputChar, key) => {
    if (isLoading && (key.escape || (inputChar === 'c' && key.ctrl))) {
      abortRef.current?.abort();
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        { id: `abort-${Date.now()}`, content: '[系统]: 已中断当前请求' }
      ]);
      return;
    }

    if (!isLoading && (inputChar === 'c' && key.ctrl)) {
      onExit();
    }
  });

  // 监听输入变化，更新命令补全建议
  useEffect(() => {
    if (!completionManagerRef.current) return;

    const trimmedInput = input.trim();
    
    if (trimmedInput.startsWith('/') && !isLoading && !isVoiceMode) {
      const newSuggestions = completionManagerRef.current.getAllSuggestions(trimmedInput);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
      setSelectedSuggestionIndex(0);
    }
  }, [input, isLoading, isVoiceMode]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const trimmedQuery = query.trim();
    
    // 处理特殊指令
    if (trimmedQuery === 'exit' || trimmedQuery === 'quit') {
      onExit();
      return;
    }
    
    // 使用统一的命令拦截器处理所有 / 开头的命令
    if (trimmedQuery.startsWith('/')) {
      const { interceptCommand } = require('../commands/CommandInterceptor');
      const result = await interceptCommand(trimmedQuery);
      
      if (result.intercepted && result.output) {
        if (result.action?.type === 'clear') {
          setMessages([]);
          setIsLoading(false);
          onClear();
        }

        if (result.action?.type === 'switchProvider') {
          setMessages([]);
          setIsLoading(false);
          onSwitchProvider(result.action.provider);
        }

        if (result.action?.type === 'activateSkill') {
          setActiveSkillName(result.action.skillName);
          globalAppState.setState({
            activeSkill: { name: result.action.skillName, prompt: result.action.prompt },
          });
        }

        setMessages(prev => [
          ...prev,
          { id: `cmd-${Date.now()}`, content: result.output }
        ]);
        setInput('');
        
        // 如果是 /voice 命令，启动语音模式
        if (trimmedQuery === '/voice') {
          setIsVoiceMode(true);
        }
        
        return;
      }
    }

    // 用户消息
    const userMsg = { id: `user-${Date.now()}`, content: `[You]: ${query}` };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // AI 初始消息
    const aiMsgId = `ai-${Date.now() + 1}`;
    setMessages(prev => [...prev, { id: aiMsgId, content: `[mini-cc]: ` }]);

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;
      // 真实对接底层大模型
      await agent.chat(query, (textChunk: string, isThinking?: boolean) => {
        if (abortController.signal.aborted) return;
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.id === aiMsgId) {
            // 如果是在思考中，我们可以做特殊的颜色标记或者只普通追加
            lastMsg.content += textChunk;
          }
          return newMsgs;
        });
      }, abortController.signal);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, content: `[网络错误]: 请检查您的 API_KEY 或网络代理。
详细信息: ${err.message}` }
      ]);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* 静态 Welcome Banner，只会打印一次并自然滚出屏幕 */}
      <Static items={welcome}>
        {(item) => <WelcomeBanner key={item.id} />}
      </Static>

      {/* 虚拟滚动的消息列表区 */}
      <Box flexDirection="column" width="100%">
        <VirtualMessageList messages={messages} columns={80} />
      </Box>

      {/* 命令补全建议 */}
      <CommandSuggestions
        suggestions={suggestions}
        selectedIndex={selectedSuggestionIndex}
        visible={showSuggestions}
      />

      {/* 底部交互区：框线包裹的输入框和操作提示 */}
      <Box flexDirection="column" marginTop={1}>
        <Box borderStyle="round" borderColor="dim" paddingX={1} width="100%">
          <Box marginRight={1}>
            <Text color="cyan">{'>'}</Text>
          </Box>
          {isLoading ? (
            <Text color="yellow">正在思考...</Text>
          ) : isVoiceMode ? (
            <Text color={isRecording ? "red" : "gray"}>
              {isRecording ? `录音中 (释放结束)${recordingDots}` : "按住 Space 开始说话 (按 Esc 或 Enter 取消)..."}
            </Text>
          ) : (
            <TextInput
              value={input}
              onChange={(newVal: string) => {
                // 处于语音模式时，阻止文本框的任何更新
                if (!isVoiceMode) {
                  setInput(newVal);
                }
              }}
              onSubmit={showSuggestions ? () => {} : handleSubmit}
              placeholder="Ask anything..."
            />
          )}
        </Box>
        
        {/* 底部提示文字 */}
        <Box paddingX={1} marginTop={0}>
          <Text color="dim">$/! shell mode • / command mode • ↵ or Ctrl+J new line</Text>
        </Box>
      </Box>
    </Box>
  );
}
