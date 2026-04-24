#!/usr/bin/env node

// 屏蔽 Node.js 21+ 关于 punycode 的弃用警告，避免破坏命令行交互界面的视觉效果
const originalEmit = process.emit;
// @ts-ignore
process.emit = function (name: string, data: any, ...args: any[]) {
  if (
    name === 'warning' &&
    typeof data === 'object' &&
    data.name === 'DeprecationWarning' &&
    data.message.includes('punycode')
  ) {
    return false;
  }
  // @ts-ignore
  return originalEmit.apply(process, [name, data, ...args]);
};

// 引入 readline 模块，用于处理命令行交互
import * as readline from 'readline';
// 引入 chalk 模块，用于命令行输出的彩色化
import chalk from 'chalk';
// 引入 dotenv 模块，用于加载环境变量
import * as dotenv from 'dotenv';
// 引入 QueryEngine 模块，用于创建查询引擎实例
import { createAgent } from './application/QueryEngine';
// 引入 LLMProvider 模块，用于创建大模型服务商实例
import { LLMProvider } from './services/providers';
// 引入 AnthropicProvider 模块，用于创建 Anthropic 服务商实例
import { createAnthropicProvider } from './services/providers/AnthropicProvider';
// 引入 OpenAIProvider 模块，用于创建 OpenAI 服务商实例
import { createOpenAIProvider } from './services/providers/OpenAIProvider';
// 引入 spawnBuddy 模块，用于创建伙伴系统实例
import { spawnBuddy } from './buddy/companion';
// 引入 globalHooks 模块，用于触发生命周期钩子触发
import { globalHooks } from './infrastructure/hooks/hooks';
// 引入 stopCapturingEarlyInput 模块，用于停止早期输入捕获
import { stopCapturingEarlyInput } from './infrastructure/utils/earlyInput';
// 引入性能分析器
import { profileCheckpoint, dumpStartupProfile } from './utils/startupProfiler';
// 引入遥测与动态配置
import { logEvent, getDynamicConfig_CACHED_MAY_BE_STALE } from './services/analytics/firstPartyEventLogger';

// 应用启动函数，负责初始化大模型服务商、触发 AppStart 生命周期钩子等
export async function startApp(prefetchConfig: any) {
  profileCheckpoint('startApp_entry');
  
  // 记录应用启动遥测事件
  logEvent('app_start', { provider: process.env.PROVIDER || 'openai' });

  // 获取早期的用户输入，避免吞键
  // 对应 01-architecture.md 里的 "Early Input Capture" 机制
  const earlyInput = stopCapturingEarlyInput();

  // 触发 AppStart 生命周期钩子
  await globalHooks.trigger('AppStart', { prefetchConfig });

  // 处理 Fast-path：极速通道，用于无需加载大模型直接返回的情况（如 --version）
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    const pkg = require('../package.json');
    console.log(`mini-cc v${pkg.version} (Fast-path)`); // pnpm dev -v
    process.exit(0);
  }

  // 初始化 dotenv 环境变量，加载 .env 文件中的配置
  dotenv.config();

  // 获取选择的大模型提供商（默认为 openai）
  const PROVIDER = (process.env.PROVIDER || 'openai').toLowerCase();
  let providerInstance: LLMProvider;

  // 根据配置初始化不同的大模型服务商
  if (PROVIDER === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const baseURL = process.env.OPENAI_BASE_URL; // 可选的 Base URL，支持兼容接口如 Qwen, DeepSeek, Kimi 等
    const modelName = process.env.MODEL_NAME || 'qwen3.6-plus'; // 默认使用 qwen3.6-plus 作为兼容模型示例

    if (!apiKey) {
      console.error(chalk.red('错误：未设置 OPENAI_API_KEY 环境变量。'));
      console.error(chalk.yellow('请在 .env 文件中设置 PROVIDER=openai 并配置 OPENAI_API_KEY'));
      process.exit(1);
    }
    console.log(chalk.gray(`[系统配置] 已选择 OpenAI 兼容模型，模型名称: ${modelName}`));
    providerInstance = createOpenAIProvider(apiKey, baseURL, modelName);
  } else {
    // 默认使用 Anthropic (Claude)
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    const modelName = process.env.MODEL_NAME || 'claude-3-7-sonnet-20250219';

    if (!apiKey) {
      console.error(chalk.red('错误：未设置 ANTHROPIC_API_KEY 环境变量。'));
      console.error(chalk.yellow('请在 .env 文件中设置 PROVIDER=anthropic 并配置 ANTHROPIC_API_KEY'));
      process.exit(1);
    }
    console.log(chalk.gray(`[系统配置] 已选择 Anthropic 模型，模型名称: ${modelName}`));
    providerInstance = createAnthropicProvider(apiKey, modelName);
  }

  // 实例化核心的 Agent 处理器，并将 provider 注入进去（依赖注入模式）
  const agent = createAgent(providerInstance);

  // 检查是否是无头模式（headless/print 模式）
  // 无头模式用于在脚本中直接调用 mini-cc 并获取结果，不显示交互式 UI
  const isHeadless = process.argv.includes('-p') || process.argv.includes('--print');
  
  if (isHeadless) {
    // 提取命令行中除了 -p/--print 以外的参数作为用户输入
    const inputArg = process.argv.slice(2).filter(arg => arg !== '-p' && arg !== '--print').join(' ');
    
    if (inputArg) {
      try {
        // 直接调用 agent，将结果流式输出到 stdout，完成后退出
        await agent.chat(inputArg, (textChunk: string, isThinking?: boolean) => {
          if (!isThinking) {
            process.stdout.write(textChunk);
          }
        });
        console.log();
      } catch (error: any) {
        console.error(`\n[系统错误] ${error.message}\n`);
        process.exit(1);
      }
      process.exit(0); // 执行完毕自动退出
    } else {
      console.error('在无头模式下需要提供输入参数。例如: mini-cc -p "写一个 hello world"');
      process.exit(1);
    }
  }

  // 启动基于 Ink/React 的交互界面
  const { render } = require('ink');
  const React = require('react');
  const { App } = require('./components/App');

  // 处理清空对话命令逻辑
  const handleClear = () => {
    if (PROVIDER === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || '';
      const baseURL = process.env.OPENAI_BASE_URL;
      const modelName = process.env.MODEL_NAME || 'qwen3.6-plus';
      providerInstance = createOpenAIProvider(apiKey, baseURL, modelName);
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      const modelName = process.env.MODEL_NAME || 'claude-3-7-sonnet-20250219';
      providerInstance = createAnthropicProvider(apiKey, modelName);
    }
    const newAgent = createAgent(providerInstance);
    Object.assign(agent, newAgent);
  };

  const handleExit = async () => {
    logEvent('app_exit');
    await globalHooks.trigger('AppExit');
    process.exit(0);
  };

  profileCheckpoint('start_react_render');
  
  // 演示：检查动态配置，如果为真则可能展示某些新特性
  const isNewUIEnabled = getDynamicConfig_CACHED_MAY_BE_STALE('enable_new_ui');
  if (isNewUIEnabled) {
    // 这里可以是特性开关控制的代码逻辑
  }

  const { waitUntilExit, clear } = render(
    React.createElement(App, {
      agent,
      onExit: handleExit,
      onClear: handleClear,
      initialInput: earlyInput
    })
  );

  // 如果传递了 --profile 参数，在渲染完成后清屏并打印出启动耗时
  if (process.argv.includes('--profile')) {
    setTimeout(() => {
      clear();
      dumpStartupProfile();
      process.exit(0);
    }, 500);
  }

  waitUntilExit().catch((err: any) => {
    console.error('Terminal UI exited with error:', err);
  });
}