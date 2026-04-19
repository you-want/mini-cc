/**
 * 定义系统中可用的生命周期钩子事件
 * 对应架构中的 Event-Driven Pattern (事件驱动模式)
 */
export type HookName = 
  | 'PreToolUse'   // 工具执行前触发（可用于权限检查、参数修改）
  | 'PostToolUse'  // 工具执行后触发（可用于日志记录、结果分析）
  | 'PreCompact'   // 触发微压缩（上下文清理）前
  | 'PostCompact'  // 微压缩完成后
  | 'AppStart'     // 应用启动时
  | 'AppExit';     // 应用退出前

/**
 * 钩子回调函数的类型定义
 */
export type HookCallback<T = any> = (context: T) => Promise<void> | void;

/**
 * 钩子系统管理器
 * 允许在应用的不同生命周期节点注册和触发事件。
 * 实现了事件发布/订阅机制。
 */
export class HookSystem {
  // 存储所有注册的钩子回调
  private hooks: Map<HookName, Set<HookCallback>> = new Map();

  /**
   * 注册一个事件监听器
   * @param hookName 要监听的钩子名称
   * @param callback 触发时执行的回调函数
   */
  register<T>(hookName: HookName, callback: HookCallback<T>) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName)!.add(callback as HookCallback);
  }

  /**
   * 触发一个事件，并按顺序执行所有注册的回调
   * @param hookName 要触发的钩子名称
   * @param context 传递给回调函数的上下文数据
   */
  async trigger<T>(hookName: HookName, context?: T): Promise<void> {
    const callbacks = this.hooks.get(hookName);
    if (!callbacks) return;

    for (const callback of callbacks) {
      await callback(context);
    }
  }

  /**
   * 清除所有已注册的钩子
   */
  clear() {
    this.hooks.clear();
  }
}

// 导出全局钩子系统实例
export const globalHooks = new HookSystem();
