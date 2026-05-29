/**
 * MCP 插件集成
 * 
 * 功能：
 * 1. 发现和加载 MCP 服务器配置
 * 2. 管理 MCP 客户端连接
 * 3. 将 MCP 工具注册到工具注册表
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createMcpClient, type McpClientInstance } from '../../services/mcp/client';

/**
 * MCP 服务器配置接口
 */
export interface McpServerConfig {
  /** 启动服务的命令，例如: 'node', 'python', 'npx' 等 */
  command: string;
  /** 传递给启动命令的参数列表 */
  args: string[];
  /** 运行该服务时注入的环境变量 */
  env?: Record<string, string>;
}

/**
 * MCP 配置文件结构
 */
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * MCP 插件集成类
 */
export class MCPPluginIntegration {
  private clients: Map<string, McpClientInstance> = new Map();
  private tools: Map<string, any> = new Map();

  /**
   * 加载所有 MCP 插件
   */
  async loadPlugins(): Promise<void> {
    const servers = await this.discoverServers();
    
    console.log(`[MCP] 发现 ${servers.length} 个 MCP 服务器配置`);
    
    for (const [name, config] of Object.entries(servers)) {
      await this.loadServer(name, config);
    }
  }

  /**
   * 发现 MCP 服务器配置
   */
  private async discoverServers(): Promise<Record<string, McpServerConfig>> {
    const configDirs = [
      path.join(os.homedir(), '.mini-cc', 'mcp-servers'),
      path.join(process.cwd(), '.mini-cc', 'mcp-servers'),
      '/usr/local/share/mini-cc/mcp-servers'
    ];

    const allServers: Record<string, McpServerConfig> = {};

    for (const dir of configDirs) {
      try {
        const exists = await fs.access(dir).then(() => true).catch(() => false);
        if (!exists) continue;

        const files = await fs.readdir(dir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const configPath = path.join(dir, file);
            try {
              const content = await fs.readFile(configPath, 'utf-8');
              const config = JSON.parse(content) as McpConfig;
              
              if (config.mcpServers) {
                Object.assign(allServers, config.mcpServers);
              }
            } catch (error) {
              console.error(`[MCP] 解析配置文件失败: ${configPath}`, error);
            }
          }
        }
      } catch (error) {
        // 目录不存在或无法访问，跳过
      }
    }

    return allServers;
  }

  /**
   * 加载单个 MCP 服务器
   */
  private async loadServer(name: string, config: McpServerConfig): Promise<void> {
    try {
      console.log(`[MCP] 正在连接到服务器: ${name}`);
      
      const client = createMcpClient(name, config);
      await client.connect();
      
      // 获取工具列表
      const tools = await this.fetchTools(client);
      
      console.log(`[MCP] 从 ${name} 加载了 ${tools.length} 个工具`);
      
      // 存储客户端和工具
      this.clients.set(name, client);
      for (const tool of tools) {
        this.tools.set(tool.name, { ...tool, serverName: name, client });
      }
      
    } catch (error) {
      console.error(`[MCP] 加载服务器 ${name} 失败:`, error);
    }
  }

  /**
   * 获取 MCP 服务器的工具列表
   */
  private async fetchTools(client: McpClientInstance): Promise<any[]> {
    try {
      const result = await client.client.listTools();
      return result.tools || [];
    } catch (error) {
      console.error('[MCP] 获取工具列表失败:', error);
      return [];
    }
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`工具 ${toolName} 不存在`);
    }

    try {
      const result = await tool.client.client.callTool({
        name: tool.name,
        arguments: args,
      });

      return result;
    } catch (error) {
      console.error(`[MCP] 调用工具 ${toolName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有已加载的工具
   */
  getTools(): Map<string, any> {
    return this.tools;
  }

  /**
   * 卸载所有插件
   */
  async unloadPlugins(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.disconnect();
        console.log(`[MCP] 已断开服务器: ${name}`);
      } catch (error) {
        console.error(`[MCP] 断开服务器 ${name} 失败:`, error);
      }
    }
    
    this.clients.clear();
    this.tools.clear();
  }
}

/**
 * 加载插件目录中的 MCP 服务器配置
 */
export function loadPluginMcpServers(pluginDir: string): Record<string, McpServerConfig> {
  const mcpServers: Record<string, McpServerConfig> = {};
  
  try {
    // 同步检查目录是否存在
    const fs = require('fs');
    if (!fs.existsSync(pluginDir)) {
      return mcpServers;
    }

    // 解析 .mcp.json
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

    // 解析 manifest.json
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
  } catch (error) {
    console.error('加载插件 MCP 服务器配置失败:', error);
  }
  
  return mcpServers;
}
