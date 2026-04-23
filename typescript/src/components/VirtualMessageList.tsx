import React, { useRef } from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

// 模拟文档中提到的 useVirtualScroll 钩子
function useVirtualScroll(scrollRef: any, keys: string[], columns: number) {
  // 真实实现中会根据终端视口高度和滚动位置计算
  // 这里改为渲染最新的 15 条消息，确保能看到最新的聊天
  const count = keys.length;
  const limit = 15;
  const start = Math.max(0, count - limit);
  return {
    range: [start, count],
    topSpacer: 0, // 移除顶部占位以防终端渲染溢出
    bottomSpacer: 0 
  };
}

function VirtualItem({ msg }: { msg: { id: string; content: string } }) {
  return (
    <Box flexDirection="row">
      <Text>{msg.content}</Text>
    </Box>
  );
}

export function VirtualMessageList({ messages, columns }: { messages: Array<{id: string, content: string}>, columns: number }) {
  const scrollRef = useRef(null);
  const keys = messages.map(m => m.id);
  
  const { range, topSpacer, bottomSpacer } = useVirtualScroll(scrollRef, keys, columns);
  const [start, end] = range;

  return (
    <Box flexDirection="column">
      <Box height={topSpacer} flexShrink={0} />
      {messages.slice(start, end).map(msg => (
        <VirtualItem key={msg.id} msg={msg} />
      ))}
      <Box height={bottomSpacer} flexShrink={0} />
    </Box>
  );
}
