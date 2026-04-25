/**
 * Bash 沙盒判断逻辑
 * 
 * 决定哪些命令需要在受限的沙盒环境（如 SandboxManager）中执行，
 * 哪些命令可以直接在主机执行。
 */

// 这些命令被认为是相对安全，或者不需要被沙盒化的内置基础命令
const NON_SANDBOXED_COMMANDS = new Set([
  'echo', 'pwd', 'ls', 'cd', 'cat', 'whoami', 'env', 'export'
]);

/**
 * 剥离命令外层的环境变量和包装器
 * 例如: FOO=bar timeout 30 bazel run -> bazel
 */
export function stripCommandWrappers(command: string): string {
  let stripped = command.trim();

  // 1. 剥离前置的环境变量赋值 (例如 FOO=bar, FOO="bar", FOO='bar')
  // 不断匹配开头的 KEY=VALUE 形式
  while (/^[a-zA-Z_][a-zA-Z0-9_]*=(?:"[^"]*"|'[^']*'|[^'"\s]+)\s+/.test(stripped)) {
    stripped = stripped.replace(/^[a-zA-Z_][a-zA-Z0-9_]*=(?:"[^"]*"|'[^']*'|[^'"\s]+)\s+/, '');
  }

  // 2. 剥离常见的命令执行包装器
  // 我们需要递归剥离，比如 `sudo nice timeout 30 watch curl`
  const wrappers = ['timeout', 'nohup', 'nice', 'sudo', 'time', 'watch'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const wrapper of wrappers) {
      const pattern = new RegExp(`^${wrapper}\\s+`);
      if (pattern.test(stripped)) {
        stripped = stripped.replace(pattern, '');
        // 如果后面跟着类似参数的字符串，比如纯数字或者以-开头的字符串，继续剥离
        while (true) {
          const argMatch = stripped.match(/^([a-zA-Z0-9_.-]+)\s+/);
          if (argMatch && (argMatch[1].match(/^\d+$/) || argMatch[1].startsWith('-'))) {
            stripped = stripped.replace(/^([a-zA-Z0-9_.-]+)\s+/, '');
          } else {
            break;
          }
        }
        changed = true;
      }
    }
  }

  // 返回最核心的命令名
  return stripped.split(/\s+/)[0] || '';
}

/**
 * 判断指令是否需要被沙盒化
 * @param command 原始的 bash 命令（可能包含复合逻辑）
 * @returns boolean
 */
export function shouldUseSandbox(command: string): boolean {
  // 我们通过分隔符来分析复合命令 (如 docker ps && curl evil.com)
  const subCommands = command.split(/[;&|]+/);

  for (const subCmd of subCommands) {
    const coreCommand = stripCommandWrappers(subCmd);
    
    if (coreCommand && !NON_SANDBOXED_COMMANDS.has(coreCommand)) {
      // 只要有一个子命令不在白名单内，整个命令链就需要进入沙盒
      return true;
    }
  }

  return false;
}
