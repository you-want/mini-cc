/// <reference types="node" />
/**
 * MCP Server 客户端示例
 *
 * 这个示例展示了如何连接到 mini-cc MCP Server 并调用工具
 *
 * 使用方法：
 * 1. 先启动服务器：node dist/server/index.js
 * 2. 运行此示例：npx ts-node tests/mcp/example_client.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SERVER_URL = 'http://localhost:3000/sse';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔌 连接到 MCP Server...\n');

  // 1. 建立连接
  const transport = new SSEClientTransport(new URL(SERVER_URL));
  const client = new Client(
    { name: 'example-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('✅ 连接成功\n');

  // 2. 列出所有可用工具
  const tools = await client.listTools();
  console.log(`📦 可用工具 (${tools.tools.length} 个):`);
  tools.tools.forEach((t) => {
    console.log(`  - ${t.name}: ${t.description?.slice(0, 50)}...`);
  });
  console.log();

  // 3. 同步调用示例：执行 Shell 命令
  console.log('=== 示例 1: 同步调用 BashTool ===');
  const result1 = await client.callTool({
    name: 'BashTool',
    arguments: { command: 'echo "Hello from MCP Client!" && date' },
  });
  console.log('结果:', (result1.content as any)[0].text);
  console.log();

  // 4. 同步调用示例：读取文件
  console.log('=== 示例 2: 同步调用 FileReadTool ===');
  const result2 = await client.callTool({
    name: 'FileReadTool',
    arguments: { file_path: '/Users/rain9/github/claude-code/mini-cc/typescript/package.json' },
  });
  const packageInfo = JSON.parse((result2.content as any)[0].text);
  console.log(`包名: ${packageInfo.name}`);
  console.log(`版本: ${packageInfo.version}`);
  console.log(`描述: ${packageInfo.description}`);
  console.log();

  // 5. 异步任务示例：提交长时间运行的任务
  console.log('=== 示例 3: 异步任务（提交 + 轮询） ===');

  // 提交任务
  const submitResult = await client.callTool({
    name: 'submit_task',
    arguments: {
      tool_name: 'BashTool',
      args: { command: 'for i in 1 2 3; do echo "Step $i"; sleep 1; done && echo "Done!"' },
    },
  });
  const taskInfo = JSON.parse((submitResult.content as any)[0].text);
  const taskId = taskInfo.task_id;
  console.log(`任务已提交，ID: ${taskId}`);
  console.log(`初始状态: ${taskInfo.status}`);
  console.log();

  // 轮询任务状态
  console.log('轮询任务状态...');
  let status = taskInfo.status;
  let attempts = 0;

  while (status !== 'completed' && status !== 'failed' && attempts < 20) {
    await sleep(500);
    attempts++;

    const statusResult = await client.callTool({
      name: 'get_task_status',
      arguments: { task_id: taskId },
    });
    const taskStatus = JSON.parse((statusResult.content as any)[0].text);
    status = taskStatus.status;

    console.log(`  [${attempts}] 状态: ${status}`);

    if (status === 'completed') {
      console.log('\n✅ 任务完成！');
      console.log('结果:', taskStatus.result);
    } else if (status === 'failed') {
      console.log('\n❌ 任务失败！');
      console.log('错误:', taskStatus.error);
    }
  }
  console.log();

  // 6. 列出所有任务
  console.log('=== 示例 4: 列出所有任务 ===');
  const listResult = await client.callTool({ name: 'list_tasks', arguments: {} });
  const tasks = JSON.parse((listResult.content as any)[0].text);
  console.log(`总任务数: ${tasks.count}`);
  tasks.tasks.forEach((t: any) => {
    console.log(`  - ${t.id}: ${t.toolName} [${t.status}]`);
  });
  console.log();

  // 7. 搜索文件示例
  console.log('=== 示例 5: 使用 GlobTool 搜索文件 ===');
  const searchResult = await client.callTool({
    name: 'GlobTool',
    arguments: {
      pattern: '**/*.ts',
      path: '/Users/rain9/github/claude-code/mini-cc/typescript/src/server',
    },
  });
  const searchInfo = JSON.parse((searchResult.content as any)[0].text);
  console.log(`找到 ${searchInfo.count} 个 TypeScript 文件:`);
  searchInfo.files.forEach((f: string) => {
    console.log(`  - ${f}`);
  });
  console.log();

  // 8. 内容搜索示例
  console.log('=== 示例 6: 使用 GrepTool 搜索内容 ===');
  const grepResult = await client.callTool({
    name: 'GrepTool',
    arguments: {
      pattern: 'export.*class',
      path: '/Users/rain9/github/claude-code/mini-cc/typescript/src/server',
      filePattern: '*.ts',
    },
  });
  const grepInfo = JSON.parse((grepResult.content as any)[0].text);
  console.log(`找到 ${grepInfo.totalMatches} 个匹配:`);
  grepInfo.matches.slice(0, 5).forEach((m: any) => {
    console.log(`  ${m.file}:${m.line} - ${m.content}`);
  });
  console.log();

  // 关闭连接
  await client.close();
  console.log('✅ 已断开连接');
}

main().catch((err) => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
