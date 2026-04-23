import React, { useState } from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import TextInput from 'ink-text-input';
import { VirtualMessageList } from './VirtualMessageList';

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

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const lowerQuery = query.toLowerCase();
    
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
        ) : (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type your message..."
          />
        )}
      </Box>
    </Box>
  );
}
