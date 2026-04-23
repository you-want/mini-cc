import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import { Box } from './ink/components/Box';
import { Text } from './ink/components/Text';
import { ProgressBar } from './components/ProgressBar';
import { VirtualMessageList } from './components/VirtualMessageList';

function DemoApp() {
  const [messages, setMessages] = useState<Array<{id: string, content: string}>>([]);

  useEffect(() => {
    // 模拟生成 100 条消息
    const msgs = Array.from({ length: 100 }).map((_, i) => ({
      id: `msg-${i}`,
      content: `[系统日志] 这是第 ${i + 1} 条长对话消息记录...`
    }));
    setMessages(msgs);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>=== mini-cc 终端 UI 渲染测试 ===</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text color="yellow">1. 动态进度条演示：</Text>
        <ProgressBar total={100} />
      </Box>

      <Box flexDirection="column">
        <Text color="yellow">2. 虚拟滚动长列表演示 (共100条，只渲染前10条)：</Text>
        <Box borderStyle="round" borderColor="gray" padding={1} width={60}>
          <VirtualMessageList messages={messages} columns={60} />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">按 Ctrl+C 退出程序</Text>
      </Box>
    </Box>
  );
}

// 启动渲染
const { waitUntilExit } = render(<DemoApp />);

// 可以在这里等待退出，如果不加，当所有 effect 跑完后进程可能就退出了
waitUntilExit().catch(console.error);
