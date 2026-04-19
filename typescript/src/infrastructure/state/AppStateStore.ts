export type ModelSetting = 'openai' | 'anthropic';

/**
 * 深度只读工具类型，用于确保外部获取的状态是不可变的 (Immutable)
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 任务状态接口
 */
export interface TaskState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description: string;
}

/**
 * 全局应用状态接口定义
 */
export interface AppState {
  settings: {
    verbose: boolean;
    mainLoopModel: ModelSetting;
  };
  tasks: { [taskId: string]: TaskState };
  toolPermissionContext: any; // 工具权限上下文 (待完善)
}

type Listener = (state: DeepReadonly<AppState>) => void;

/**
 * 全局状态管理类 (Observer Pattern / 观察者模式)
 * 
 * 类似于 Redux 或 Zustand。它维护一个单一的全局状态树，
 * 允许组件订阅状态变化并在状态更新时收到通知。
 * 这种模式确保了状态的集中管理和数据流的单向性。
 */
export class AppStateStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set(); // 存储所有订阅的监听器

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  /**
   * 获取当前状态的只读快照
   */
  getState(): DeepReadonly<AppState> {
    return this.state as DeepReadonly<AppState>;
  }

  /**
   * 更新状态并通知所有订阅者
   * @param partialState 包含要更新的字段的偏态对象
   */
  setState(partialState: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...partialState, // 合并新状态
    };
    this.notify(); // 通知订阅者
  }

  /**
   * 订阅状态变化
   * @param listener 回调函数
   * @returns 取消订阅的函数
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener); // 返回用于解绑的清理函数
    };
  }

  /**
   * 触发通知，将最新的只读状态分发给所有监听器
   */
  private notify(): void {
    const readonlyState = this.getState();
    for (const listener of this.listeners) {
      listener(readonlyState);
    }
  }
}

// 导出全局单例实例，供应用各层共享访问
export const globalAppState = new AppStateStore({
  settings: {
    verbose: false,
    mainLoopModel: 'openai',
  },
  tasks: {},
  toolPermissionContext: {},
});

/**
 * 模拟 React hook 风格的状态选择器（用于纯 TS 环境）
 * 允许提取全局状态树中的某个特定切片
 */
export function useAppState<T>(selector: (state: DeepReadonly<AppState>) => T): T {
  return selector(globalAppState.getState());
}

/**
 * 模拟 React hook 风格的状态更新器
 */
export function useSetAppState() {
  return (partialState: Partial<AppState>) => globalAppState.setState(partialState);
}
