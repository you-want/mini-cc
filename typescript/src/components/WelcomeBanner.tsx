import React from 'react';
import * as os from 'os';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';
import * as configManager from '../utils/configManager';

export function WelcomeBanner() {
  const userName = os.userInfo().username || process.env.USER || 'developer';
  const modelName = configManager.getConfigValue('MODEL_NAME') || process.env.MODEL_NAME || 'qwen3.6-plus';
  const cwd = process.cwd();
  const homedir = os.homedir();
  const displayCwd = cwd.startsWith(homedir) ? `~${cwd.slice(homedir.length)}` : cwd;
  
  // 简单获取版本号
  let version = '1.0.0';
  try {
    const pkg = require('../../package.json');
    version = pkg.version || '1.0.0';
  } catch (e) {
    // 忽略错误
  }

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} width="100%" flexDirection="row">
      {/* 左侧区域 */}
      <Box width="50%" flexDirection="column">
        <Text color="cyan" bold>mini-cc CLI {version} (Mini Claude Code)</Text>
        
        {/* Logo 区：根据 logo.svg 设计，使用 ANSI 块字符和前景色/背景色组合出高还原度的图案 */}
        {/* logo 是一个带荧光绿边框的黑底方块，里面有 "cc" 和两个小方块 */}
        <Box marginTop={1} marginBottom={1} flexDirection="column">
          <Text color="greenBright">▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄</Text>
          <Text color="greenBright">█<Text backgroundColor="black" color="greenBright">                   </Text>█</Text>
          <Text color="greenBright">█<Text backgroundColor="black" color="greenBright">  <Text color="white">◆ ◆</Text>            </Text>█</Text>
          <Text color="greenBright">█<Text backgroundColor="black" color="greenBright" bold>  cc               </Text>█</Text>
          <Text color="greenBright">█<Text backgroundColor="black" color="greenBright">               <Text color="white">■</Text>   </Text>█</Text>
          <Text color="greenBright">█<Text backgroundColor="black" color="greenBright">                   </Text>█</Text>
          <Text color="greenBright">▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀</Text>
        </Box>
        
        <Text>Welcome back, <Text color="cyan">{userName}</Text></Text>
        <Text>Model: {modelName}</Text>
        <Text color="gray">{displayCwd}</Text>
      </Box>

      {/* 右侧区域 */}
      <Box width="50%" flexDirection="column" paddingLeft={3}>
        <Text color="cyan" bold>Announcements</Text>
        <Text>Try Codebase Copilot</Text>
        <Text>Website: https://mini-cc.raingpt.top/</Text>
        <Text>Github: https://github.com/you-want/mini-cc</Text>
        
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
