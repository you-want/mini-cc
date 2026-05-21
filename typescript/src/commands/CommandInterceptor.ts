/**
 * 命令拦截器
 * 
 * 功能：拦截特殊命令（如 /provider、/buddy、/voice 等），在进入 Agent 循环前处理
 */

import { spawnBuddy } from '../buddy/companion';
import { CompanionBones } from '../buddy/types';
import { triggerVoiceMode } from './voice';
import { showProviderList, switchProvider, parseProviderCommand } from './ProviderCommand';
import { showSkillList, searchSkills, useSkill, parseSkillCommand } from './SkillCommand';
import chalk from 'chalk';
import { globalAppState } from '../infrastructure/state/AppStateStore';
import { readConfig } from '../utils/configManager';

export type InterceptAction =
  | { type: 'clear' }
  | { type: 'switchProvider'; provider: any; providerName: string; scope: 'session' | 'global' }
  | { type: 'activateSkill'; skillName: string; prompt: string };

export interface InterceptResult {
  intercepted: boolean;
  output?: string;
  shouldExit?: boolean;
  action?: InterceptAction;
}

export async function interceptCommand(input: string): Promise<InterceptResult> {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return { intercepted: false };
  }
  
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (command) {
    case 'provider':
      return await handleProviderCommand(args);
    
    case 'skill':
      return handleSkillCommand(args);

    case 'allow':
      return handleAllowCommand(args);

    case 'deny':
      return handleDenyCommand(args);

    case 'permissions':
      return handlePermissionsCommand();
    
    case 'buddy':
      return handleBuddyCommand(args);
    
    case 'voice':
      return await handleVoiceCommand();
    
    case 'clear':
      return handleClearCommand();
    
    case 'help':
      return handleHelpCommand();
    
    default:
      return {
        intercepted: true,
        output: chalk.red(`❌ 未知命令: /${command}\n`) +
                chalk.gray('输入 /help 查看可用命令'),
      };
  }
}

function handleAllowCommand(args: string[]): InterceptResult {
  const toolName = (args[0] || '').trim();
  if (!toolName) {
    return {
      intercepted: true,
      output: chalk.red('❌ 用法：/allow <ToolName>'),
    };
  }

  const state = globalAppState.getState();
  const nextAllowed = new Set<string>(state.toolPermissionContext.allowedTools as any);
  const nextDenied = new Set<string>(state.toolPermissionContext.deniedTools as any);
  nextAllowed.add(toolName);
  nextDenied.delete(toolName);

  globalAppState.setState({
    toolPermissionContext: {
      strategy: state.toolPermissionContext.strategy,
      allowedTools: nextAllowed,
      deniedTools: nextDenied,
    },
  });

  return {
    intercepted: true,
    output: chalk.green(`✓ 已授权当前会话执行工具：${toolName}`),
  };
}

function handleDenyCommand(args: string[]): InterceptResult {
  const toolName = (args[0] || '').trim();
  if (!toolName) {
    return {
      intercepted: true,
      output: chalk.red('❌ 用法：/deny <ToolName>'),
    };
  }

  const state = globalAppState.getState();
  const nextAllowed = new Set<string>(state.toolPermissionContext.allowedTools as any);
  const nextDenied = new Set<string>(state.toolPermissionContext.deniedTools as any);
  nextDenied.add(toolName);
  nextAllowed.delete(toolName);

  globalAppState.setState({
    toolPermissionContext: {
      strategy: state.toolPermissionContext.strategy,
      allowedTools: nextAllowed,
      deniedTools: nextDenied,
    },
  });

  return {
    intercepted: true,
    output: chalk.yellow(`✓ 已禁止当前会话执行工具：${toolName}`),
  };
}

function handlePermissionsCommand(): InterceptResult {
  const state = globalAppState.getState();
  const allowed = Array.from(state.toolPermissionContext.allowedTools as any).sort();
  const denied = Array.from(state.toolPermissionContext.deniedTools as any).sort();

  const cfg = readConfig();
  const hardDenyCfg = Array.isArray(cfg.HARD_DENY_TOOLS) ? cfg.HARD_DENY_TOOLS : (cfg.HARD_DENY_TOOLS ? String(cfg.HARD_DENY_TOOLS) : '');
  const hardDenyEnv = process.env.HARD_DENY_TOOLS || '';

  let output = chalk.cyan.bold('\n🔐 权限系统\n\n');
  output += `策略: ${chalk.green(state.toolPermissionContext.strategy)}\n\n`;

  output += chalk.yellow('已授权工具（/allow）：\n');
  output += allowed.length ? `  ${allowed.join(', ')}\n\n` : chalk.gray('  （空）\n\n');

  output += chalk.yellow('已禁止工具（/deny）：\n');
  output += denied.length ? `  ${denied.join(', ')}\n\n` : chalk.gray('  （空）\n\n');

  output += chalk.yellow('hard_deny（强制禁止）：\n');
  const hardDenyHint = [hardDenyCfg, hardDenyEnv].filter(Boolean).join(' | ');
  output += hardDenyHint ? `  ${chalk.gray(hardDenyHint)}\n\n` : chalk.gray('  （未配置）\n\n');

  output += chalk.gray('用法：\n');
  output += chalk.gray('  /allow <ToolName>        - 预审批敏感工具（当前会话）\n');
  output += chalk.gray('  /deny <ToolName>         - 禁止工具（当前会话）\n');
  output += chalk.gray('  /permissions             - 查看权限状态\n');

  return {
    intercepted: true,
    output,
  };
}

async function handleProviderCommand(args: string[]): Promise<InterceptResult> {
  const parsed = parseProviderCommand(args);
  
  if (parsed.action === 'list') {
    return {
      intercepted: true,
      output: showProviderList(),
    };
  }
  
  const result = await switchProvider(parsed.providerName!, parsed.options);
  
  return {
    intercepted: true,
    output: result.message,
    action: result.success && result.provider
      ? {
          type: 'switchProvider',
          provider: result.provider,
          providerName: parsed.providerName!,
          scope: parsed.options.sessionOnly ? 'session' : 'global',
        }
      : undefined,
  };
}

function handleSkillCommand(args: string[]): InterceptResult {
  const parsed = parseSkillCommand(args);
  
  if (parsed.action === 'list') {
    return {
      intercepted: true,
      output: showSkillList(),
    };
  }
  
  if (parsed.action === 'search') {
    return {
      intercepted: true,
      output: searchSkills(parsed.query || ''),
    };
  }
  
  const result = useSkill(parsed.skillName!);
  
  return {
    intercepted: true,
    output: result.message,
    action: result.success && result.prompt
      ? { type: 'activateSkill', skillName: parsed.skillName!, prompt: result.prompt }
      : undefined,
  };
}

function handleBuddyCommand(args: string[]): InterceptResult {
  const seed = args.length > 0 ? args[0] : (process.env.USER || 'default_user');
  const buddy: CompanionBones = spawnBuddy(seed);
  
  const speciesName = buddy.species === 'duck' ? '小黄鸭' : '小章鱼';
  const emoji = buddy.species === 'duck' ? '🦆' : '🐙';
  
  const output = chalk.cyan.bold('\n🐾 你的数字伙伴\n\n') +
    `${emoji} ${chalk.yellow(speciesName)}\n` +
    `稀有度: ${chalk.magenta(buddy.rarity)}\n` +
    `闪光: ${buddy.shiny ? chalk.yellow('✨ 是') : chalk.gray('否')}\n` +
    `属性: DEBUGGING ${buddy.stats.DEBUGGING} | PATIENCE ${buddy.stats.PATIENCE} | CHAOS ${buddy.stats.CHAOS}\n\n` +
    chalk.gray('你的伙伴会陪伴你一起编程！');
  
  return {
    intercepted: true,
    output,
  };
}

async function handleVoiceCommand(): Promise<InterceptResult> {
  const message = await triggerVoiceMode();
  
  return {
    intercepted: true,
    output: chalk.cyan(message),
  };
}

function handleClearCommand(): InterceptResult {
  return {
    intercepted: true,
    output: chalk.green('✓ 已清空当前会话上下文'),
    action: { type: 'clear' },
  };
}

function handleHelpCommand(): InterceptResult {
  const output = chalk.cyan.bold('\n📖 可用命令\n\n') +
    chalk.yellow('Provider 管理：\n') +
    '  /provider              - 查看当前 Provider 和可用列表\n' +
    '  /provider <name>       - 切换 Provider（全局）\n' +
    '  /provider <name> -s    - 切换 Provider（仅当前会话）\n\n' +
    
    chalk.yellow('技能系统：\n') +
    '  /skill                 - 查看所有可用技能\n' +
    '  /skill <name>          - 使用指定技能\n' +
    '  /skill search <query>  - 搜索技能\n\n' +

    chalk.yellow('权限系统：\n') +
    '  /allow <ToolName>      - 预审批敏感工具（当前会话）\n' +
    '  /deny <ToolName>       - 禁止工具（当前会话）\n' +
    '  /permissions           - 查看权限状态\n\n' +
    
    chalk.yellow('趣味功能：\n') +
    '  /buddy [seed]          - 召唤数字伙伴\n' +
    '  /voice                 - 语音模式（模拟）\n\n' +
    
    chalk.yellow('其他：\n') +
    '  /clear                 - 清空对话\n' +
    '  /help                  - 显示此帮助信息\n\n' +
    
    chalk.gray('提示：直接输入问题即可与 AI 对话');
  
  return {
    intercepted: true,
    output,
  };
}

export class EasterEggInterceptor {
  static intercept(args: string[]): boolean {
    if (args.length === 0) return false;
    
    const command = args[0];
    
    if (command === '/buddy') {
      const seed = args.length > 1 ? args[1] : (process.env.USER || 'default_user');
      const buddy: CompanionBones = spawnBuddy(seed);
      
      const speciesName = buddy.species === 'duck' ? '小黄鸭' : '小章鱼';
      const emoji = buddy.species === 'duck' ? '🦆' : '🐙';
      
      console.log(chalk.cyan.bold('\n🐾 你的数字伙伴\n'));
      console.log(`${emoji} ${chalk.yellow(speciesName)}`);
      console.log(`稀有度: ${chalk.magenta(buddy.rarity)}`);
      console.log(`闪光: ${buddy.shiny ? chalk.yellow('✨ 是') : chalk.gray('否')}`);
      console.log(`属性: DEBUGGING ${buddy.stats.DEBUGGING} | PATIENCE ${buddy.stats.PATIENCE} | CHAOS ${buddy.stats.CHAOS}\n`);
      
      return true;
    }
    
    if (command === '/voice') {
      triggerVoiceMode().then(msg => console.log(chalk.cyan(msg)));
      return true;
    }
    
    return false;
  }
}
