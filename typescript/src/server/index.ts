#!/usr/bin/env node
import { MiniCCMcpServer } from './McpServer';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('🚀 启动 mini-cc MCP Server...');

  const server = new MiniCCMcpServer();

  await server.start(PORT);

  console.log('\n✅ 服务器已就绪！');
  console.log('\n可用端点：');
  console.log(`  - SSE:    http://localhost:${PORT}/sse`);
  console.log(`  - 消息:   http://localhost:${PORT}/message`);
  console.log(`  - 健康检查: http://localhost:${PORT}/health`);

  console.log('\n使用方式：');
  console.log('1. 客户端连接到 SSE 端点建立会话');
  console.log('2. 通过消息端点发送 JSON-RPC 请求');
  console.log('3. 支持同步调用和异步任务（submit_task + get_task_status）');

  // 优雅关闭
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 正在关闭服务器...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 正在关闭服务器...');
    await server.shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
