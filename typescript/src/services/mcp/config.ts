import fs from 'fs';
import path from 'path';
// 引入 MCP 插件配置接口
import { loadPluginMcpServers, McpServerConfig } from '../../utils/plugins/mcpPluginIntegration';

/**
 * 聚合用户和项目的 MCP 配置
 * 
 * 这个函数负责将不同层级的 MCP 服务配置进行合并。
 * 加载优先级：
 * 1. 插件目录 (.mini-cc/plugins)
 * 2. 用户全局配置 (~/.mini-cc/settings.json)
 * 3. 项目局部配置 (.mini-cc/settings.json) (优先级最高，会覆盖前面的同名配置)
 * 
 * 这种多层级的配置聚合设计，既保证了灵活扩展（用户可以全局安装自己喜欢的工具），
 * 又兼顾了项目的隔离性（每个项目可以拥有自己特定的内部 MCP 插件）。
 * 
 * @param workspaceDir 当前正在运行的工作区根目录
 * @returns 合并后的 MCP 服务器配置对象映射
 */
export function getMergedMcpConfig(workspaceDir: string): Record<string, McpServerConfig> {
  const mergedServers: Record<string, McpServerConfig> = {};

  // 1. 从插件加载 (模拟从 .mini-cc/plugins/ 目录)
  const pluginsDir = path.join(workspaceDir, '.mini-cc', 'plugins');
  const pluginServers = loadPluginMcpServers(pluginsDir);
  Object.assign(mergedServers, pluginServers);

  // 2. 从用户的全局配置 (~/.mini-cc/settings.json) 加载 (模拟)
  // 适合放置一些通用的工具，例如全局的天气查询、系统监控插件等
  const userSettingsPath = path.join(process.env.HOME || '', '.mini-cc', 'settings.json');
  if (fs.existsSync(userSettingsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'));
      if (data.mcpServers) Object.assign(mergedServers, data.mcpServers);
    } catch (e) {
      console.warn('解析用户全局 settings.json 失败');
    }
  }

  // 3. 从项目目录的局部配置 (.mini-cc/settings.json) 加载 (模拟)
  // 适合放置与当前项目强相关的工具，例如操作特定项目数据库的插件
  const projectSettingsPath = path.join(workspaceDir, '.mini-cc', 'settings.json');
  if (fs.existsSync(projectSettingsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf-8'));
      if (data.mcpServers) Object.assign(mergedServers, data.mcpServers);
    } catch (e) {
      console.warn('解析项目局部 settings.json 失败');
    }
  }

  return mergedServers;
}
