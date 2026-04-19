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

import * as readline from 'readline';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { createAgent } from './core/Agent';
import { LLMProvider } from './core/providers';
import { createAnthropicProvider } from './core/providers/AnthropicProvider';
import { createOpenAIProvider } from './core/providers/OpenAIProvider';
import { spawnBuddy } from './buddy/companion';

// 处理 Fast-path：极速通道，用于无需加载大模型直接返回的情况（如 --version）
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  console.log('mini-cc v1.0.0 (Fast-path)');
  process.exit(0);
}

// 初始化 dotenv 环境变量
dotenv.config();

// 获取选择的大模型提供商（默认为 openai）
const PROVIDER = (process.env.PROVIDER || 'openai').toLowerCase();
let providerInstance: LLMProvider;

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
  // 默认使用 Anthropic
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

// 实例化核心的 Agent 处理器，并注入指定的 provider
const agent = createAgent(providerInstance);

// 创建 readline 接口，以便监听用户的命令行输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('mini-cc> ')
});

console.log(chalk.bold.blue('\n=== 欢迎使用 mini-cc ===\n'));
console.log(chalk.gray('输入您的需求，我将为您编写代码或执行系统操作。'));
console.log(chalk.gray('键入 "exit" 或 "quit" 退出程序。\n'));

// 显示帮助信息
function showHelp() {
  console.log(chalk.cyan('\n=== 可用命令 ==='));
  console.log(chalk.gray('  /help     - 显示此帮助信息'));
  console.log(chalk.gray('  /clear    - 清空当前对话历史'));
  console.log(chalk.gray('  /buddy    - 召唤电子宠物彩蛋'));
  console.log(chalk.gray('  exit/quit - 退出程序'));
  console.log(chalk.cyan('==============\n'));
}

// 显示命令行前缀提示符
rl.prompt();

// 监听终端输入的回车事件
rl.on('line', async (line) => {
  const input = line.trim();

  // 忽略空输入
  if (!input) {
    rl.prompt();
    return;
  }

  // 处理退出命令
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log(chalk.green('再见！'));
    process.exit(0);
  }

  // 处理帮助命令
  if (input.toLowerCase() === '/help') {
    showHelp();
    rl.prompt();
    return;
  }

  // 处理清空对话命令
  if (input.toLowerCase() === '/clear') {
    // 重新创建 provider 实例以清空对话历史
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
    // 重新实例化 Agent
    const newAgent = createAgent(providerInstance);
    // 替换全局 agent 引用（这里使用一个技巧来更新 agent 实例）
    Object.assign(agent, newAgent);
    console.log(chalk.green('✓ 对话历史已清空。'));
    rl.prompt();
    return;
  }

  // 检查是否触发彩蛋系统 (文档 08: 电子宠物)
  if (input.toLowerCase() === '/buddy') {
    spawnBuddy();
    rl.prompt();
    return;
  }

  // 开始执行 Agent 循环
  console.log(chalk.dim('\n[Agent] 已收到指令，正在思考中...\n'));
  
  try {
    await agent.chat(input, (text: string, isThinking?: boolean) => {
      // 区分思考过程和模型回复
      if (isThinking) {
        process.stdout.write(chalk.dim(text));
      } else {
        process.stdout.write(chalk.green(text));
      }
    });
    console.log(); // 输出结束后换行
  } catch (error: any) {
    console.error(chalk.red(`\n[系统错误] ${error.message}\n`));
  }

  // 本轮交互结束，恢复等待用户输入
  rl.prompt();
}).on('close', () => {
  console.log(chalk.green('\n再见！'));
  process.exit(0);
});