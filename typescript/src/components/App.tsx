import React, { useState, useRef } from 'react';
import { useInput } from 'ink';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import TextInputModule from 'ink-text-input';
import { VirtualMessageList } from './VirtualMessageList';

// 兼容 Bun 打包后的 CommonJS 导出格式
const TextInput = typeof TextInputModule === 'function' ? TextInputModule : (TextInputModule as any).default;

interface AppProps {
  agent: any;
  onExit: () => void;
  onClear: () => void;
  initialInput?: string;
}

export function App({ agent, onExit, onClear, initialInput = '' }: AppProps) {
  const [messages, setMessages] = useState<Array<{ id: string; content: string }>>([
    { id: 'welcome1', content: '=== 欢迎使用 mini-cc (React UI 模式) ===' },
    { id: 'welcome2', content: '输入您的需求，我将为您编写代码或执行系统操作。' },
    { id: 'welcome3', content: '键入 "exit" 或 "quit" 退出程序。键入 "/clear" 清空历史。' },
  ]);
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);

  // 语音模式状态
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDots, setRecordingDots] = useState('');
  const releaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const lowerQuery = query.trim().toLowerCase();
    
    // 处理特殊指令
    if (lowerQuery === 'exit' || lowerQuery === 'quit') {
      onExit();
      return;
    }
    
    if (lowerQuery === '/clear') {
      setMessages([{ id: Date.now().toString(), content: '✓ 对话历史已清空。' }]);
      setInput('');
      onClear();
      return;
    }

    if (lowerQuery.startsWith('/buddy')) {
      const buddyModule = require('../buddy/companion');
      const args = query.trim().split(/\s+/);
      // 支持自定义种子，如果没有提供则使用系统用户名或默认值
      const seed = args.length > 1 ? args[1] : (process.env.USER || 'default_user');
      const bones = buddyModule.generateBones(seed);
      
      const speciesName = bones.species === 'duck' ? '🦆 小黄鸭 (Duck)' : '🐙 小章鱼 (Octopus)';
      const shinyText = bones.shiny ? '✨ 是 (Shiny!)' : '否';
      const statsText = Object.entries(bones.stats).map(([k, v]) => `${k}: ${v}`).join(' | ');
      
      setMessages(prev => [
        ...prev, 
        { id: `buddy-${Date.now()}`, content: `🐾 宠物: ${speciesName}\n🎭 稀有度: ${bones.rarity}\n✨ 闪光: ${shinyText}\n📊 属性: ${statsText}` }
      ]);
      setInput('');
      return;
    }

    if (lowerQuery === '/voice') {
      const { triggerVoiceMode } = require('../commands/voice');
      triggerVoiceMode().then((msg: string) => {
        setMessages(prev => [
          ...prev, 
          { id: `voice-${Date.now()}`, content: msg }
        ]);
        setIsVoiceMode(true);
      });
      setInput('');
      return;
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
      // 真实对接底层大模型
      await agent.chat(query, (textChunk: string, isThinking?: boolean) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.id === aiMsgId) {
            // 如果是在思考中，我们可以做特殊的颜色标记或者只普通追加
            lastMsg.content += textChunk;
          }
          return newMsgs;
        });
      });
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, content: `[系统错误]: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* 虚拟滚动的消息列表区 */}
      <Box flexDirection="column">
        <VirtualMessageList messages={messages} columns={80} />
      </Box>

      {/* 底部交互区 */}
      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={1}>
          <Text color="cyan">mini-cc{'>'}</Text>
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
              onSubmit={handleSubmit}
              placeholder="Type your message..."
            />
        )}
      </Box>
    </Box>
  );
}
