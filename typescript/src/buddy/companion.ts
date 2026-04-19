import chalk from 'chalk';

/**
 * 【伙伴系统】
 * 用于模拟一个简单的交互助手，在用户遇到错误或者卡住时主动给予反馈。
 * 类似于 Claude Code 里的伴随小精灵（比如提供快速补救措施、或者缓解焦虑的提示）。
 *
 * @param event 触发伴随系统的事件名称
 * @param context 当前上下文数据
 */
export function spawnBuddy(event: string, context: any = {}) {
  console.log(chalk.magenta(`[Buddy] 看起来你触发了 ${event} 事件！有什么我可以帮忙的吗？`));
  if (context.error) {
    console.log(chalk.gray(`[Buddy 提示] 我注意到出现了一个错误: ${context.error.message}`));
    console.log(chalk.gray(`[Buddy 建议] 要不要尝试使用 'fix it' 命令让我帮你排查一下？`));
  }
}