import React, { useState, useEffect } from 'react';
// 引入自研 Ink 框架的基础组件 (此处用包装过的 ink 模拟)
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

export function ProgressBar({ total }: { total: number }) {
  const [current, setCurrent] = useState(0);

  // 用 useEffect 模拟扫描进度递增
  useEffect(() => {
    if (current >= total) return;
    const timer = setTimeout(() => setCurrent(c => c + 1), 50);
    return () => clearTimeout(timer);
  }, [current, total]);

  const percentage = Math.round((current / total) * 100);
  // 用方块字符模拟进度条填充效果
  const filled = '█'.repeat(Math.floor(percentage / 10));
  const empty = '░'.repeat(10 - Math.floor(percentage / 10));

  return (
    // 直接用 Flexbox 属性布局，这就是 Yoga 引擎的威力
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
