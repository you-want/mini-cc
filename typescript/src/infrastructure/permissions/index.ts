export type PermissionStrategyType = 'default' | 'plan' | 'auto' | 'acceptEdits';

export interface PermissionContext {
  strategy: PermissionStrategyType;
  allowedTools: Set<string>;
  deniedTools: Set<string>;
}

export interface PermissionStrategy {
  check(toolName: string, args: any, context: PermissionContext): Promise<boolean>;
}

export class DefaultStrategy implements PermissionStrategy {
  async check(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
    if (context.allowedTools.has(toolName)) return true;
    if (context.deniedTools.has(toolName)) return false;
    
    // In a real terminal, this would prompt the user.
    // For now, we simulate interactive approval.
    console.log(`[Permissions] (Default Strategy) Requesting user permission to run: ${toolName}`);
    return true; // Simulate auto-yes for CLI demo
  }
}

export class AutoStrategy implements PermissionStrategy {
  async check(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
    console.log(`[Permissions] (Auto Strategy) Auto-approving tool run: ${toolName}`);
    return true; // Auto-approve everything
  }
}

export class PermissionManager {
  private strategies: Map<PermissionStrategyType, PermissionStrategy> = new Map();

  constructor() {
    this.strategies.set('default', new DefaultStrategy());
    this.strategies.set('auto', new AutoStrategy());
  }

  async requestPermission(toolName: string, args: any, context: PermissionContext): Promise<boolean> {
    const strategy = this.strategies.get(context.strategy);
    if (!strategy) {
      throw new Error(`Strategy ${context.strategy} not found`);
    }
    return strategy.check(toolName, args, context);
  }
}

export const globalPermissionManager = new PermissionManager();
