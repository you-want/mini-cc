import { Tool, ToolUseContext } from '../../infrastructure/tools/Tool';
import { McpClientInstance } from '../../services/mcp/client';
import { buildMcpToolName } from '../../services/mcp/mcpStringUtils';

/**
 * MCP 代理工具创建工厂 (透明代理模式)
 * 
 * 核心原理：
 * 这个函数负责把远端 MCP Server 返回的工具定义（Schema），
 * 包装成 Claude Code 引擎能够直接理解的本地 `Tool<T, string>` 接口。
 * 
 * 对大模型（QueryEngine）而言，它根本不知道它在调用一个跑在其他进程（甚至可能是远程服务器上）的工具。
 * 它只管传入参数，然后获取返回的字符串。这实现了极大的解耦！
 *
 * @param serverName MCP 服务器的名称
 * @param mcpClient 已建立连接的 MCP 客户端实例
 * @param toolDef 远端返回的工具定义（包含工具名、描述、输入参数的 Schema）
 * @returns 一个符合 Claude Code 引擎标准的 Tool 接口实例
 */
export function createMcpTool(
  serverName: string,
  mcpClient: McpClientInstance,
  toolDef: any
): Tool<any, string> {
  // 使用 mcpStringUtils.ts 中的方法为工具名称打上包装前缀
  // 防止不同插件中出现重名的工具
  const proxyName = buildMcpToolName(serverName, toolDef.name);

  return {
    name: proxyName,
    // 在描述前面加上插件来源，有助于大模型在思考时明白这个工具的背景
    description: `(MCP 插件来自 ${serverName}) ${toolDef.description || ''}`,
    // 直接透传远端的参数定义 Schema 给大模型
    inputSchema: toolDef.inputSchema,
    
    // 大模型决定调用该工具时，引擎会执行这个方法
    execute: async (args: any, context: ToolUseContext): Promise<string> => {
      console.log(`[MCPTool] 转发请求到 ${serverName} 插件的工具 ${toolDef.name}...`);
      
      try {
        // 通过基于 stdio 的 JSON-RPC 连接，将调用请求序列化后发送给远端子进程
        const response = await mcpClient.client.callTool({
          name: toolDef.name,
          arguments: args,
        });

        // 解析远端返回的数据结构
        // 根据 MCP 协议规范，返回值中的 content 是一个包含了不同媒体类型的数组
        if (response && response.content && Array.isArray(response.content)) {
          // 我们这里提取出所有的文本类型内容，并将其拼接成字符串返回给大模型
          return response.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        }
        
        // 如果返回的格式不标准，直接将其序列化为字符串兜底
        return JSON.stringify(response);
      } catch (error: any) {
        console.error(`[MCPTool] 调用插件 ${serverName} 失败:`, error);
        // 插件挂了或者报错，优雅地将错误信息返回给大模型，大模型看到错误后可能会尝试自我修正
        return `插件执行失败: ${error.message}`;
      }
    },
  };
}
