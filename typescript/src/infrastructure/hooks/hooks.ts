export type HookName = 
  | 'PreToolUse' 
  | 'PostToolUse' 
  | 'PreCompact' 
  | 'PostCompact' 
  | 'AppStart' 
  | 'AppExit';

export type HookCallback<T = any> = (context: T) => Promise<void> | void;

export class HookSystem {
  private hooks: Map<HookName, Set<HookCallback>> = new Map();

  register<T>(hookName: HookName, callback: HookCallback<T>) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName)!.add(callback as HookCallback);
  }

  async trigger<T>(hookName: HookName, context?: T): Promise<void> {
    const callbacks = this.hooks.get(hookName);
    if (!callbacks) return;

    for (const callback of callbacks) {
      await callback(context);
    }
  }

  clear() {
    this.hooks.clear();
  }
}

export const globalHooks = new HookSystem();
