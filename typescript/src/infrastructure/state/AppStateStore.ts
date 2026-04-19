export type ModelSetting = 'openai' | 'anthropic';

// DeepImmutable utility type
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export interface TaskState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description: string;
}

export interface AppState {
  settings: {
    verbose: boolean;
    mainLoopModel: ModelSetting;
  };
  tasks: { [taskId: string]: TaskState };
  toolPermissionContext: any; // To be refined
}

type Listener = (state: DeepReadonly<AppState>) => void;

export class AppStateStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  getState(): DeepReadonly<AppState> {
    return this.state as DeepReadonly<AppState>;
  }

  setState(partialState: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...partialState,
    };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const readonlyState = this.getState();
    for (const listener of this.listeners) {
      listener(readonlyState);
    }
  }
}

// Global singleton instance
export const globalAppState = new AppStateStore({
  settings: {
    verbose: false,
    mainLoopModel: 'openai',
  },
  tasks: {},
  toolPermissionContext: {},
});

// React-like hook for vanilla TS usage with selector and equality check
export function useAppState<T>(selector: (state: DeepReadonly<AppState>) => T): T {
  return selector(globalAppState.getState());
}

export function useSetAppState() {
  return (partialState: Partial<AppState>) => globalAppState.setState(partialState);
}
