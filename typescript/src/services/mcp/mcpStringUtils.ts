/**
 * MCP 工具名称工具函数
 * 用于构建和解析透明代理的工具名称。
 * 
 * 为什么需要这个？
 * 因为我们可能会加载多个不同的 MCP 插件，它们可能都会提供同名的工具（比如都叫 "query_data"）。
 * 为了避免命名冲突，也为了让主引擎知道这个工具应该路由给哪个插件进程，
 * 我们会在把它注册给大模型之前，对它的名字进行“包装”（加上前缀）。
 */

const MCP_TOOL_PREFIX = 'mcp__';

/**
 * 将远端 MCP 工具名称打上本地代理前缀
 * 
 * 例如：serverName="weather", toolName="get_weather"
 * 转换后: "mcp__weather__get_weather"
 * 大模型实际看到和调用的，就是这个包装后的名字。
 * 
 * @param serverName MCP 服务器名称
 * @param toolName 工具原始名称
 */
export function buildMcpToolName(serverName: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${serverName}__${toolName}`;
}

/**
 * 检查一个工具是否为 MCP 代理工具
 * (只要是以 "mcp__" 开头，我们就认为是插件提供的外部工具)
 */
export function isMcpTool(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

/**
 * 从代理名称中解析出服务器名和原始工具名
 * 
 * 当大模型发回一个 `mcp__weather__get_weather` 的调用请求时，
 * 引擎会使用此函数把它重新拆开，以便知道：
 * 1. 找哪个 mcpClient
 * 2. 传给插件的实际工具名是什么
 * 
 * @param proxyName 代理工具名
 */
export function parseMcpToolName(proxyName: string): { serverName: string; toolName: string } | null {
  if (!isMcpTool(proxyName)) return null;
  const parts = proxyName.slice(MCP_TOOL_PREFIX.length).split('__');
  if (parts.length < 2) return null;
  return {
    serverName: parts[0],
    toolName: parts.slice(1).join('__'),
  };
}
