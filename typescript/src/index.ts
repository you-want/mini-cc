#!/usr/bin/env node
import * as readline from 'readline';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { Agent } from './core/Agent';
import { LLMProvider } from './core/providers';
import { AnthropicProvider } from './core/providers/AnthropicProvider';
import { OpenAIProvider } from './core/providers/OpenAIProvider';

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
  providerInstance = new OpenAIProvider(apiKey, baseURL, modelName);
} else {
  // 默认使用 Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const modelName = process.env.MODEL_NAME || 'claude-3-7-sonnet-20250219';

  if (!apiKey) {
    console.error(chalk.red('错误：未设置 ANTHROPIC_API_KEY 环境变量。'));
    console.error(chalk.yellow('请在 .env 文件中设置 ANTHROPIC_API_KEY=your-api-key-here'));
    process.exit(1);
  }
  console.log(chalk.gray(`[系统配置] 已选择 Anthropic 模型，模型名称: ${modelName}`));
  providerInstance = new AnthropicProvider(apiKey, modelName);
}

// 实例化核心的 Agent 处理器，并注入指定的 provider
const agent = new Agent(providerInstance);

// 创建 readline 接口，以便监听用户的命令行输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('mini-cc> ')
});

console.log(chalk.bold.blue('\n=== 欢迎使用 mini-claude-code ===\n'));
console.log(chalk.gray('输入您的需求，我将为您编写代码或执行系统操作。'));
console.log(chalk.gray('键入 "exit" 或 "quit" 退出程序。\n'));

// 显示命令行前缀提示符
rl.prompt();

// 监听终端输入的回车事件
rl.on('line', async (line) => {
  const input = line.trim();

  // 处理退出命令
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log(chalk.green('再见！'));
    process.exit(0);
  }

  // 忽略空输入
  if (!input) {
    rl.prompt();
    return;
  }

  // 开始执行 Agent 循环
  console.log(chalk.dim('\n[Agent] 开始处理任务...'));
  
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
