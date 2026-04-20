/**
 * 定义权限策略的类型
 * default: 默认策略（可能需要用户确认危险操作）
 * plan: 计划模式策略
 * auto: 自动模式策略（自动同意所有操作）
 * acceptEdits: 接受所有编辑的策略
 */
export type PermissionStrategyType = 'default' | 'plan' | 'auto' | 'acceptEdits';

/**
 * 权限上下文
 * 保存当前会话的权限状态，包括启用的策略和工具的白名单/黑名单
 */
export interface PermissionContext {
  strategy: PermissionStrategyType;
  allowedTools: Set<string>;
  deniedTools: Set<string>;
}

/**
 * 权限策略接口 (Strategy Pattern / 策略模式)
 * 允许动态切换不同的权限校验算法（如需要询问用户 vs 自动放行）
 */
export interface PermissionStrategy {
  /**
   * 检查是否允许执行特定的工具
   * @param toolName 工具名称
   * @param args 工具的调用参数
   * @param context 当前的权限上下文
   */
  check(toolName: string, args: any, context: PermissionContext): Promise<boolean>;
}

/**
 * 默认权限策略实现
 * 正常情况下，执行高危工具时应该在这里拦截并询问用户。
 */
export function createDefaultStrategy(): PermissionStrategy {
  return {
    async check(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
      // 检查白名单和黑名单
      if (context.allowedTools.has(toolName)) return true;
      if (context.deniedTools.has(toolName)) return false;
      
      // 在真实的终端应用中，这里会调用 readline 询问用户是否允许执行。
      // 目前为了简化演示，模拟用户自动同意 (Auto-yes)
      console.log(`[Permissions] (默认策略) 请求用户授权执行: ${toolName}`);
      return true; 
    }
  };
}

/**
 * 自动权限策略实现
 * 在全自动模式下使用，跳过所有用户确认。
 */
export function createAutoStrategy(): PermissionStrategy {
  return {
    async check(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
      console.log(`[Permissions] (自动策略) 自动批准工具执行: ${toolName}`);
      return true; // 直接批准一切操作
    }
  };
}

/**
 * 权限管理器接口
 */
export interface PermissionManager {
  requestPermission: (toolName: string, args: any, context: PermissionContext) => Promise<boolean>;
}

/**
 * 创建权限管理器实例 (Context / 环境角色)
 * 维护所有的策略实例，并根据上下文指定的策略进行权限请求的路由分发。
 */
export function createPermissionManager(): PermissionManager {
  const strategies: Map<PermissionStrategyType, PermissionStrategy> = new Map();

  // 注册内置的权限策略
  strategies.set('default', createDefaultStrategy());
  strategies.set('auto', createAutoStrategy());

  /**
   * 向指定的策略请求执行权限
   */
  async function requestPermission(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
    const strategy = strategies.get(context.strategy);
    if (!strategy) {
      throw new Error(`未找到权限策略: ${context.strategy}`);
    }
    return strategy.check(toolName, args, context);
  }

  return {
    requestPermission
  };
}

// 导出全局单例权限管理器
export const globalPermissionManager = createPermissionManager();
