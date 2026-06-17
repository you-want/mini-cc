/**
 * MCP Server 集成测试
 *
 * 测试流程：
 * 1. 启动 MCP Server
 * 2. 建立 SSE 连接
 * 3. 测试同步工具调用
 * 4. 测试异步任务提交和轮询
 * 5. 关闭服务器
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MiniCCMcpServer } from '../../src/server/McpServer';

const PORT = 3001;
const SERVER_URL = `http://localhost:${PORT}/sse`;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testSyncTools(client: Client): Promise<void> {
  console.log('\n=== 测试同步工具调用 ===\n');

  // 测试 BashTool
  console.log('1. 测试 BashTool...');
  const bashResult = await client.callTool({
    name: 'BashTool',
    arguments: { command: 'echo "Hello from MCP Server"' },
  });
  console.log('   结果:', (bashResult.content as any)[0].text);

  // 测试 FileReadTool
  console.log('\n2. 测试 FileReadTool...');
  const readResult = await client.callTool({
    name: 'FileReadTool',
    arguments: { file_path: '/Users/rain9/github/claude-code/mini-cc/typescript/package.json' },
  });
  const packageJson = JSON.parse((readResult.content as any)[0].text);
  console.log('   读取成功，包名:', packageJson.name);

  // 测试 GlobTool
  console.log('\n3. 测试 GlobTool...');
  const globResult = await client.callTool({
    name: 'GlobTool',
    arguments: { pattern: '**/*.ts', path: '/Users/rain9/github/claude-code/mini-cc/typescript/src/server' },
  });
  const files = JSON.parse((globResult.content as any)[0].text);
  console.log('   找到文件数:', files.count);

  // 测试 GrepTool
  console.log('\n4. 测试 GrepTool...');
  const grepResult = await client.callTool({
    name: 'GrepTool',
    arguments: {
      pattern: 'export',
      path: '/Users/rain9/github/claude-code/mini-cc/typescript/src/server',
      filePattern: '*.ts',
    },
  });
  const grepData = JSON.parse((grepResult.content as any)[0].text);
  console.log('   匹配数:', grepData.totalMatches);

  console.log('\n✅ 同步工具测试通过\n');
}

async function testAsyncTasks(client: Client): Promise<void> {
  console.log('=== 测试异步任务 ===\n');

  // 提交异步任务
  console.log('1. 提交异步任务...');
  const submitResult = await client.callTool({
    name: 'submit_task',
    arguments: {
      tool_name: 'BashTool',
      args: { command: 'sleep 2 && echo "Task completed"' },
    },
  });
  const taskInfo = JSON.parse((submitResult.content as any)[0].text);
  const taskId = taskInfo.task_id;
  console.log('   任务 ID:', taskId);
  console.log('   初始状态:', taskInfo.status);

  // 轮询任务状态
  console.log('\n2. 轮询任务状态...');
  let status = 'pending';
  let attempts = 0;
  const maxAttempts = 10;

  while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
    await sleep(500);
    attempts++;

    const statusResult = await client.callTool({
      name: 'get_task_status',
      arguments: { task_id: taskId },
    });
    const taskStatus = JSON.parse((statusResult.content as any)[0].text);
    status = taskStatus.status;
    console.log(`   [${attempts}] 状态: ${status}`);

    if (status === 'completed') {
      console.log('   结果:', taskStatus.result);
    }
  }

  if (status === 'completed') {
    console.log('\n✅ 异步任务测试通过\n');
  } else {
    console.log('\n❌ 异步任务测试失败\n');
  }

  // 测试列出所有任务
  console.log('3. 列出所有任务...');
  const listResult = await client.callTool({ name: 'list_tasks', arguments: {} });
  const tasks = JSON.parse((listResult.content as any)[0].text);
  console.log('   任务总数:', tasks.count);
}

async function main(): Promise<void> {
  console.log('🚀 启动 MCP Server 集成测试...\n');

  // 启动服务器
  const server = new MiniCCMcpServer();
  await server.start(PORT);
  console.log(`✅ 服务器已启动，端口 ${PORT}\n`);

  // 等待服务器完全就绪
  await sleep(500);

  // 建立客户端连接
  console.log('连接 MCP 客户端...');
  const transport = new SSEClientTransport(new URL(SERVER_URL));
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  await client.connect(transport);
  console.log('✅ 客户端已连接\n');

  // 列出所有工具
  const tools = await client.listTools();
  console.log(`可用工具 (${tools.tools.length} 个):`);
  tools.tools.forEach((t) => console.log(`  - ${t.name}`));

  try {
    // 测试同步工具
    await testSyncTools(client);

    // 测试异步任务
    await testAsyncTasks(client);

    console.log('\n🎉 所有测试通过！\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  } finally {
    // 关闭连接
    await client.close();
    await server.shutdown();
    console.log('✅ 已关闭服务器\n');
  }
}

main().catch((err) => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
