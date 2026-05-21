/**
 * Provider 热切换命令处理器
 * 
 * 功能：允许用户在运行时切换 LLM Provider，无需重启应用
 * 
 * 使用场景：
 * - /provider - 查看当前 Provider 和可用列表
 * - /provider openai - 切换到 OpenAI（全局）
 * - /provider anthropic --session - 切换到 Anthropic（仅当前会话）
 * 
 * 教学要点：
 * 1. 热切换：运行时动态更换服务提供商，无需重启
 * 2. 作用域：支持全局和会话级两种切换范围
 * 3. 配置持久化：全局切换会保存到配置文件
 */

import { readConfig, writeConfig } from '../utils/configManager';
import { createOpenAIProvider } from '../services/providers/OpenAIProvider';
import { createAnthropicProvider } from '../services/providers/AnthropicProvider';
import { LLMProvider } from '../services/providers';
import chalk from 'chalk';

/**
 * 可用的 Provider 配置
 */
export interface ProviderConfig {
  name: string;
  displayName: string;
  description: string;
  requiresApiKey: string;
  requiresBaseUrl?: boolean;
  defaultModel: string;
}

/**
 * 支持的 Provider 列表
 */
export const AVAILABLE_PROVIDERS: ProviderConfig[] = [
  {
    name: 'openai',
    displayName: 'OpenAI / Compatible',
    description: '支持 OpenAI API 和兼容接口（如通义千问、DeepSeek）',
    requiresApiKey: 'OPENAI_API_KEY',
    requiresBaseUrl: true,
    defaultModel: 'gpt-4',
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    description: 'Anthropic 官方 Claude 模型',
    requiresApiKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-7-sonnet-20250219',
  },
];

/**
 * Provider 切换选项
 */
export interface ProviderSwitchOptions {
  sessionOnly?: boolean; // 是否仅切换当前会话
}

/**
 * 显示当前 Provider 和可用列表
 */
export function showProviderList(): string {
  const config = readConfig();
  const currentProvider = process.env.PROVIDER || config.PROVIDER || 'openai';
  const currentModel = process.env.MODEL_NAME || config.MODEL_NAME || 'unknown';

  let output = chalk.cyan.bold('\n📋 Provider 管理\n\n');
  
  output += chalk.yellow('当前配置：\n');
  output += `  Provider: ${chalk.green(currentProvider)}\n`;
  output += `  Model: ${chalk.green(currentModel)}\n\n`;
  
  output += chalk.yellow('可用 Providers：\n');
  
  AVAILABLE_PROVIDERS.forEach((provider, index) => {
    const isCurrent = provider.name === currentProvider;
    const marker = isCurrent ? chalk.green('✓') : ' ';
    
    output += `  ${marker} ${index + 1}. ${chalk.cyan(provider.displayName)}\n`;
    output += `     ${chalk.gray(provider.description)}\n`;
    output += `     需要: ${chalk.yellow(provider.requiresApiKey)}`;
    if (provider.requiresBaseUrl) {
      output += `, ${chalk.yellow('BASE_URL')}`;
    }
    output += `\n`;
    output += `     默认模型: ${chalk.gray(provider.defaultModel)}\n\n`;
  });
  
  output += chalk.gray('使用方法：\n');
  output += chalk.gray('  /provider <name>           - 全局切换 Provider\n');
  output += chalk.gray('  /provider <name> --session - 仅当前会话切换\n');
  output += chalk.gray('  /provider                  - 显示此帮助信息\n');
  
  return output;
}

/**
 * 切换 Provider
 */
export async function switchProvider(
  providerName: string,
  options: ProviderSwitchOptions = {}
): Promise<{ success: boolean; message: string; provider?: LLMProvider }> {
  
  // 查找 Provider 配置
  const providerConfig = AVAILABLE_PROVIDERS.find(p => p.name === providerName.toLowerCase());
  
  if (!providerConfig) {
    return {
      success: false,
      message: chalk.red(`❌ 未知的 Provider: ${providerName}\n`) + 
               chalk.gray('可用的 Providers: ') + 
               AVAILABLE_PROVIDERS.map(p => p.name).join(', '),
    };
  }
  
  // 读取配置
  const config = readConfig();
  
  // 检查必需的 API Key
  const apiKey = process.env[providerConfig.requiresApiKey] || 
                 config[providerConfig.requiresApiKey];
  
  if (!apiKey) {
    return {
      success: false,
      message: chalk.red(`❌ 缺少 API Key: ${providerConfig.requiresApiKey}\n`) +
               chalk.gray(`请先设置: mini-cc config set ${providerConfig.requiresApiKey}=<your-key>`),
    };
  }
  
  // 创建新的 Provider 实例
  let newProvider: LLMProvider;
  
  try {
    if (providerConfig.name === 'openai') {
      const baseURL = process.env.OPENAI_BASE_URL || config.OPENAI_BASE_URL;
      const modelName = process.env.MODEL_NAME || config.MODEL_NAME || providerConfig.defaultModel;
      newProvider = createOpenAIProvider(apiKey, baseURL, modelName);
    } else if (providerConfig.name === 'anthropic') {
      const modelName = process.env.MODEL_NAME || config.MODEL_NAME || providerConfig.defaultModel;
      newProvider = createAnthropicProvider(apiKey, modelName);
    } else {
      return {
        success: false,
        message: chalk.red(`❌ Provider ${providerName} 尚未实现`),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: chalk.red(`❌ 创建 Provider 失败: ${error.message}`),
    };
  }
  
  // 保存配置（如果是全局切换）
  if (!options.sessionOnly) {
    config.PROVIDER = providerConfig.name;
    writeConfig(config);
  }
  
  const scope = options.sessionOnly ? '当前会话' : '全局';
  const modelDisplayName = providerConfig.name === 'openai' 
    ? (process.env.MODEL_NAME || config.MODEL_NAME || providerConfig.defaultModel)
    : (process.env.MODEL_NAME || config.MODEL_NAME || providerConfig.defaultModel);
    
  const message = chalk.green(`✓ 已切换到 ${providerConfig.displayName} (${scope})\n`) +
                  chalk.gray(`  模型: ${modelDisplayName}`);
  
  return {
    success: true,
    message,
    provider: newProvider,
  };
}

/**
 * 解析 Provider 命令参数
 */
export function parseProviderCommand(args: string[]): {
  action: 'list' | 'switch';
  providerName?: string;
  options: ProviderSwitchOptions;
} {
  if (args.length === 0) {
    return { action: 'list', options: {} };
  }
  
  const providerName = args[0];
  const sessionOnly = args.includes('--session') || args.includes('-s');
  
  return {
    action: 'switch',
    providerName,
    options: { sessionOnly },
  };
}
