/**
 * Agent 通信和任务管理系统
 * 
 * 功能：管理多个 Agent 的并行执行、通信和状态跟踪
 * 
 * 教学要点：
 * 1. 任务注册表：全局管理所有 Agent 任务
 * 2. 进程间通信：Agent 之间可以共享信息
 * 3. 状态管理：跟踪每个 Agent 的执行状态
 */

export interface AgentTask {
  id: string;
  name: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
  memory?: Record<string, any>;
}

export class AgentRegistry {
  private static instance: AgentRegistry;
  private tasks: Map<string, AgentTask> = new Map();
  private sharedMemory: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  public registerTask(task: AgentTask): void {
    this.tasks.set(task.id, task);
    console.log(`[AgentRegistry] 注册任务: ${task.name} (${task.id})`);
  }

  public updateTaskStatus(
    id: string,
    status: AgentTask['status'],
    result?: string,
    error?: string
  ): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      if (error) task.error = error;
      if (status === 'completed' || status === 'failed') {
        task.endTime = Date.now();
      }
    }
  }

  public getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  public getRunningTasks(): AgentTask[] {
    return this.getAllTasks().filter(t => t.status === 'running');
  }

  public setSharedMemory(key: string, value: any): void {
    this.sharedMemory.set(key, value);
    console.log(`[AgentRegistry] 共享记忆更新: ${key}`);
  }

  public getSharedMemory(key: string): any {
    return this.sharedMemory.get(key);
  }

  public getAllSharedMemory(): Record<string, any> {
    const result: Record<string, any> = {};
    this.sharedMemory.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  public clearCompletedTasks(): void {
    const completed = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'failed');
    
    completed.forEach(([id]) => this.tasks.delete(id));
    console.log(`[AgentRegistry] 清理了 ${completed.length} 个已完成任务`);
  }
}
