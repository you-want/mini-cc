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
  
  // 获取 Provider 以便展示
  const provider = configManager.getConfigValue('PROVIDER') || process.env.PROVIDER || 'openai';
  const providerDisplay = provider === 'openai' ? 'OpenAI / Compatible' : 'Anthropic';
  
  // 简单获取版本号
  let version = '1.0.0';
  try {
    const pkg = require('../../package.json');
    version = pkg.version || '1.0.0';
  } catch (e) {
    // 忽略错误
  }

  return (
    <Box borderStyle="round" borderColor="#CCFF00" paddingX={2} paddingY={1} width="100%" flexDirection="row">
      {/* 左侧区域 */}
      <Box width="50%" flexDirection="column">
        <Text color="cyan" bold>mini-cc CLI {version}</Text>
        
        <Box marginTop={0} marginBottom={0} flexDirection="column">
          <Text color="#CCFF00">▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505" color="#CCFF00">               </Text>█</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505">  <Text color="#CCFF00" bold>cc</Text>       <Text color="#E5E5E5">■</Text>   </Text>█</Text>
          <Text color="#CCFF00">█<Text backgroundColor="#050505" color="#CCFF00">               </Text>█</Text>
          <Text color="#CCFF00">▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀</Text>
        </Box>
        
        <Text>Welcome back, <Text color="cyan">{userName}</Text></Text>
        <Text>Model: <Text  color="cyan">{modelName}</Text></Text>
        <Text>Provider: <Text  color="cyan">{providerDisplay}</Text></Text>
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
