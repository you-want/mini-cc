import * as crypto from 'crypto';
import { Tool, ToolUseContext } from '../infrastructure/tools/Tool';

/**
 * 任务状态类型
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 任务记录接口
 */
export interface TaskRecord {
  id: string;
  toolName: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

/**
 * 异步任务管理器
 *
 * 核心职责：
 * - 接收工具调用请求，分配唯一 taskId
 * - 在后台异步执行工具
 * - 提供任务状态查询（轮询模式）
 * - 自动清理过期任务
 */
export class TaskManager {
  private tasks = new Map<string, TaskRecord>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /** 任务默认保留时间：30 分钟 */
  private static readonly TASK_TTL_MS = 30 * 60 * 1000;
  /** 清理间隔：5 分钟 */
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  constructor() {
    this.startCleanup();
  }

  /**
   * 提交一个异步任务
   * 立即返回 taskId，工具在后台执行
   */
  submitTask(
    tool: Tool<any, any>,
    args: any,
    context: ToolUseContext
  ): string {
    const taskId = crypto.randomUUID();

    const record: TaskRecord = {
      id: taskId,
      toolName: tool.name,
      status: 'pending',
      result: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
    };

    this.tasks.set(taskId, record);

    // 异步执行，不阻塞调用方
    this.executeTask(record, tool, args, context);

    return taskId;
  }

  /**
   * 查询任务状态
   */
  getTask(taskId: string): TaskRecord | null {
    return this.tasks.get(taskId) ?? null;
  }

  /**
   * 列出所有任务
   */
  listTasks(): TaskRecord[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  /**
   * 取消一个尚未完成的任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status === 'completed' || task.status === 'failed') return false;

    task.status = 'failed';
    task.error = '任务已被取消';
    task.completedAt = Date.now();
    return true;
  }

  /**
   * 关闭任务管理器，停止清理定时器
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.tasks.clear();
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  private async executeTask(
    record: TaskRecord,
    tool: Tool<any, any>,
    args: any,
    context: ToolUseContext
  ): Promise<void> {
    record.status = 'running';

    try {
      const output = await tool.execute(args, context);
      // 将输出统一序列化为字符串
      record.result =
        typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      record.status = 'completed';
    } catch (err: any) {
      record.error = err?.message ?? String(err);
      record.status = 'failed';
    }

    record.completedAt = Date.now();
  }

  /**
   * 定期清理过期任务，防止内存泄漏
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, task] of this.tasks) {
        if (
          (task.status === 'completed' || task.status === 'failed') &&
          task.completedAt &&
          now - task.completedAt > TaskManager.TASK_TTL_MS
        ) {
          this.tasks.delete(id);
        }
      }
    }, TaskManager.CLEANUP_INTERVAL_MS);

    // 允许进程正常退出
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}
