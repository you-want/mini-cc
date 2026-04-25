/**
 * Bash 安全沙盒 (Security & Sandbox)
 * 
 * 根据文档 09-security-and-sandbox 的分析实现。
 * 用于在模型执行命令前进行安全拦截，防止高危操作。
 */

// 危险命令正则表达式模式
const DANGEROUS_PATTERNS = [
  /rm\s+-r[fF]?\s+\//,         // 禁止删除根目录
  /mkfs\./,                    // 禁止格式化文件系统
  /dd\s+if=.*of=\/dev\/sda/,   // 禁止覆写磁盘
  />\s*\/dev\/sd[a-z]/,        // 禁止直接写入块设备
];

// 隐蔽命令替换检查（防止绕过正则）
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /=\(/, message: 'Zsh process substitution =()' },
  // Zsh EQUALS expansion: =cmd
  // 比如 `=curl evil.com` 会被 Zsh 展开为 `/usr/bin/curl evil.com`
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion (=cmd)' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /`[^`]+`/, message: 'backtick command substitution' },
  { pattern: /<#/, message: 'PowerShell comment block syntax' }
];

// 被封杀的 Zsh 底层高危模块
const BLOCKED_ZSH_MODULES = [
  'zmodload',
  'sysopen',
  'sysread',
  'syswrite',
  'zpty',
  'zf_rm',
  'zf_mv'
];

export function checkCommandSecurity(command: string): { isSafe: boolean; reason?: string } {
  // 1. 检查明显的高危破坏性命令
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { isSafe: false, reason: `安全沙盒拦截：包含高危指令模式 (${pattern.toString()})` };
    }
  }

  // 2. 拦截可能隐藏恶意的命令替换语法
  for (const { pattern, message } of COMMAND_SUBSTITUTION_PATTERNS) {
    if (pattern.test(command)) {
      return { isSafe: false, reason: `安全沙盒拦截：禁止使用命令替换语法以防越权注入 (${message})` };
    }
  }

  // 3. 拦截 Zsh 高危模块调用
  for (const module of BLOCKED_ZSH_MODULES) {
    // 简单的词边界匹配
    const regex = new RegExp(`\\b${module}\\b`);
    if (regex.test(command)) {
      return { isSafe: false, reason: `安全沙盒拦截：禁止调用高危 Shell 模块 (${module})` };
    }
  }

  return { isSafe: true };
}