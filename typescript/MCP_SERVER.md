# mini-cc MCP Server

将 mini-cc 的工具系统封装为 MCP 服务，供外部 Agent 调用。

## 功能特性

- **7 个业务工具**：BashTool、FileReadTool、FileWriteTool、GitStatus、GlobTool、GrepTool、WebFetchTool
- **异步任务支持**：通过 submit_task 提交任务，通过 get_task_status 轮询结果
- **标准 MCP 协议**：兼容所有支持 MCP 的客户端
- **SSE 传输层**：基于 HTTP 的 Server-Sent Events

## 快速开始

### 本地运行

```bash
# 安装依赖
pnpm install

# 编译
pnpm build

# 启动服务器
node dist/server/index.js

# 或指定端口
PORT=8080 node dist/server/index.js
```

### Docker 运行

```bash
# 构建镜像
docker build -t mini-cc-mcp-server .

# 运行容器
docker run -p 3000:3000 mini-cc-mcp-server

# 挂载工作目录
docker run -p 3000:3000 -v /your/workspace:/workspace mini-cc-mcp-server
```

## API 端点

- **SSE 连接**: `GET /sse` - 建立 MCP 会话
- **消息发送**: `POST /message?sessionId={id}` - 发送 JSON-RPC 请求
- **健康检查**: `GET /health` - 检查服务状态

## 工具列表

### 业务工具

1. **BashTool** - 执行 Shell 命令
2. **FileReadTool** - 读取文件
3. **FileWriteTool** - 写入文件
4. **GitStatus** - 获取 Git 状态
5. **GlobTool** - 文件搜索
6. **GrepTool** - 内容搜索
7. **WebFetchTool** - HTTP 请求

### 任务管理工具

1. **submit_task** - 提交异步任务
2. **get_task_status** - 查询任务状态
3. **list_tasks** - 列出所有任务
4. **cancel_task** - 取消任务

## 使用示例

### Python 客户端

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client

async def main():
    async with sse_client("http://localhost:3000/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # 列出工具
            tools = await session.list_tools()
            print("可用工具:", [t.name for t in tools.tools])
            
            # 同步调用
            result = await session.call_tool("BashTool", {"command": "echo hello"})
            print("结果:", result.content[0].text)
            
            # 异步任务
            task = await session.call_tool("submit_task", {
                "tool_name": "BashTool",
                "args": {"command": "sleep 2 && echo done"}
            })
            task_id = json.loads(task.content[0].text)["task_id"]
            
            # 轮询状态
            while True:
                status = await session.call_tool("get_task_status", {"task_id": task_id})
                data = json.loads(status.content[0].text)
                if data["status"] in ["completed", "failed"]:
                    print("任务完成:", data["result"])
                    break
                await asyncio.sleep(1)
```

### Node.js 客户端

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(new URL('http://localhost:3000/sse'));
const client = new Client({ name: 'test-client', version: '1.0.0' });

await client.connect(transport);

// 列出工具
const tools = await client.listTools();
console.log('可用工具:', tools.tools.map(t => t.name));

// 调用工具
const result = await client.callTool({
  name: 'BashTool',
  arguments: { command: 'echo hello' }
});
console.log('结果:', result.content[0].text);
```

## 环境变量

- `PORT` - 服务器端口（默认 3000）
- `WORKSPACE_DIR` - 工作目录（默认当前目录）

## 架构

```
┌─────────────────┐     SSE/HTTP    ┌──────────────────┐
│  外部 Agent     │ ←─────────────→ │  mini-cc Server  │
│ (Claude/GPT/...)│                 │  (MCP Protocol)  │
└─────────────────┘                 └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │   工具执行引擎    │
                                    │ (文件/命令/网络)  │
                                    └──────────────────┘
```

## 许可证

MIT
