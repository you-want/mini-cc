export interface DestructivePattern {
  pattern: RegExp;
  warning: string;
}

export const DESTRUCTIVE_PATTERNS: DestructivePattern[] = [
  // Git 相关的灾难性操作：不仅防 reset，还防带 --force 的 push
  { pattern: /\bgit\s+reset\s+--hard\b/, warning: 'Note: may discard uncommitted changes' },
  { pattern: /\bgit\s+push\b[^;&|\n]*[ \t](--force|--force-with-lease|-f)\b/, warning: 'Note: may overwrite remote history' },
  
  // 经典的文件删除：严谨的正则防绕过（比如 rm -rf, rm -fr）
  { pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f|(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*f[a-zA-Z]*[rR]/, warning: 'Note: may recursively force-remove files' },

  // 数据库毁灭者
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, warning: 'Note: may drop or truncate database objects' },
  { pattern: /\bDELETE\s+FROM\s+\w+[ \t]*(;|"|'|\n|$)/i, warning: 'Note: may delete all rows from a database table' },

  // 连基础设施都不放过
  { pattern: /\bkubectl\s+delete\b/, warning: 'Note: may delete Kubernetes resources' },
  { pattern: /\bterraform\s+destroy\b/, warning: 'Note: may destroy Terraform infrastructure' },
];

/**
 * 检查命令是否具有破坏性
 * @param command 要执行的 bash 命令
 * @returns 返回破坏性警告信息，如果没有则返回 null
 */
export function checkDestructiveCommand(command: string): string | null {
  for (const { pattern, warning } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      return warning;
    }
  }
  return null;
}
