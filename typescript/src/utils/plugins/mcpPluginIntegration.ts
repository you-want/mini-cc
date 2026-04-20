import fs from 'fs';
import path from 'path';

/**
 * MCP 服务器配置接口
 * 定义了如何启动一个本地或远程的 MCP 服务
 */
export interface McpServerConfig {
  /** 启动服务的命令，例如: 'node', 'python', 'npx' 等 */
  command: string;
  /** 传递给启动命令的参数列表，例如: ['server.js'], ['-m', 'mcp_server'] */
  args: string[];
  /** 运行该服务时注入的环境变量，常用于传递 API Keys 等敏感信息 */
  env?: Record<string, string>;
}

/**
 * MCP 配置文件结构
 * 通常对应 `.mcp.json` 或 `.mini-cc/settings.json` 中的 `mcpServers` 字段
 */
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * 加载插件目录中的 MCP 服务器配置 (模拟 Claude Code 的插件生态系统)
 * 
 * 在真实的 Claude Code 中，插件可以是别人写好的 NPM 包、Python 包或者 MCPB (MCP Bundle)。
 * 这个函数的作用是扫描指定的插件目录，解析它们的配置文件，并提取出 MCP 服务器的启动参数。
 *
 * @param pluginDir 插件的根目录路径
 * @returns 包含所有已解析的 MCP 服务器配置的字典对象
 */
export function loadPluginMcpServers(pluginDir: string): Record<string, McpServerConfig> {
  const mcpServers: Record<string, McpServerConfig> = {};
  
  if (!fs.existsSync(pluginDir)) {
    return mcpServers;
  }

  // 1. 解析 .mcp.json (简单模拟)
  // 这是早期或精简版插件常用的配置方式
  const mcpJsonPath = path.join(pluginDir, '.mcp.json');
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const content = fs.readFileSync(mcpJsonPath, 'utf-8');
      const data = JSON.parse(content) as McpConfig;
      if (data.mcpServers) {
        Object.assign(mcpServers, data.mcpServers);
      }
    } catch (e) {
      console.error(`解析 MCP 配置文件失败: ${mcpJsonPath}`, e);
    }
  }

  // 2. 解析 manifest.json (简单模拟)
  // 标准的插件包通常会包含一个 manifest.json 来声明它所提供的 MCP 服务
  const manifestPath = path.join(pluginDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const data = JSON.parse(content);
      if (data.mcpServers) {
        Object.assign(mcpServers, data.mcpServers);
      }
    } catch (e) {
      console.error(`解析插件清单文件失败: ${manifestPath}`, e);
    }
  }

  // 3. 真实源码还会处理 .mcpb 文件下载与解压，这里略过
  // Claude Code 支持将插件打包成 .mcpb (MCP Bundle) 压缩包。
  // 它会自动下载、解压缓存，并提示用户配置所需的 API 密钥。
  
  return mcpServers;
}
