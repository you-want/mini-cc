import { createMcpClient } from '../../src/services/mcp/client';
import { createMcpTool } from '../../src/tools/MCPTool/MCPTool';
import path from 'path';

async function main() {
  console.log('--- 测试 MCP 插件通信 ---');
  
  const serverPath = path.join(__dirname, '../../examples/mcp-servers/weather.js');
  
  // 1. 创建客户端连接 (模拟读取到配置)
  const mcpClient = createMcpClient('weather', {
    command: 'node',
    args: [serverPath],
  });

  try {
    await mcpClient.connect();
    console.log('✅ MCP Client 连接成功');

    // 2. 获取远端注册的工具列表
    const toolsResult = await mcpClient.client.listTools();
    console.log('📦 远端暴露的工具:', JSON.stringify(toolsResult.tools, null, 2));

    // 3. 构建透明代理的 Tool 实例
    const weatherToolDef = toolsResult.tools.find((t: any) => t.name === 'get_weather');
    if (!weatherToolDef) throw new Error('未找到 get_weather 工具');

    const weatherTool = createMcpTool('weather', mcpClient, weatherToolDef);
    console.log(`\n构建的本地代理工具名: ${weatherTool.name}`);
    console.log(`工具描述: ${weatherTool.description}`);

    // 4. 模拟大模型调用工具
    console.log('\n🚀 模拟大模型调用天气查询工具...');
    const result = await weatherTool.execute({ city: 'Beijing' }, { workspaceDir: process.cwd() } as any);
    console.log(`返回结果: ${result}`);

    const result2 = await weatherTool.execute({ city: 'Shanghai' }, { workspaceDir: process.cwd() } as any);
    console.log(`返回结果: ${result2}`);

  } catch (err) {
    console.error('测试失败:', err);
  } finally {
    // 5. 断开连接并清理子进程
    await mcpClient.disconnect();
  }
}

main();
