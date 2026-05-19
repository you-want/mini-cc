import { Tool, ToolUseContext } from './Tool';
import { TaskState } from '../state/AppStateStore';

/**
 * TaskListTool 输出结果中的任务项
 */
interface TaskListItem {
  id: string;
  status: string;
  description: string;
}

/**
 * TaskListTool 输出结果
 */
interface TaskListOutput {
  tasks: TaskListItem[];
  message: string;
}

/**
 * TaskListTool - 任务列表工具
 * 
 * 功能：查看当前会话中所有任务的列表和状态。
 * 
 * 使用场景：
 * - 查看所有已创建的任务及其状态
 * - 了解哪些任务正在进行、已完成或待处理
 * - 在开始新工作前检查是否有未完成的任务
 * - 跟踪多任务并行执行的进度
 * 
 * 教学要点：
 * 1. TaskList 是只读操作，不会修改任何状态
 * 2. 返回的任务列表按创建顺序排列
 * 3. 可以通过任务 ID 使用 TaskUpdate 来更新特定任务
 * 4. 空列表表示没有创建过任何任务
 * 5. 建议在完成当前任务后调用 TaskList 查找下一个可用任务
 * 
 * 示例用法：
 * ```json
 * {}  // 不需要任何参数
 * ```
 * 
 * 输出示例：
 * ```
 * #task_a1b2c3d4 [pending] 实现用户认证模块
 * #task_e5f6g7h8 [running] 编写单元测试
 * #task_i9j0k1l2 [completed] 更新文档
 * ```
 */
export const taskListTool: Tool<{}, TaskListOutput> = {
  name: 'TaskList',
  description: `
    列出当前会话中的所有任务及其状态。
    
    适用场景：
    - 查看所有已创建的任务
    - 了解任务的当前状态（pending/running/completed/failed）
    - 在开始新工作前检查是否有未完成的任务
    - 跟踪多个并行任务的进度
    
    任务状态说明：
    - pending: 待处理，尚未开始执行
    - running: 正在执行中
    - completed: 已成功完成
    - failed: 执行失败
    
    重要规则：
    1. 这是一个只读操作，不会修改任何状态
    2. 任务按创建顺序显示
    3. 如果列表为空，表示还没有创建任何任务
    4. 完成任务后，建议调用 TaskList 查找下一个可用任务
    5. 可以使用任务 ID 配合 TaskUpdate 工具来更新任务状态
    
    注意：
    - 只显示当前会话创建的任务
    - 不显示已删除的任务
  `,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  execute: async (
    args: {},
    context: ToolUseContext
  ): Promise<TaskListOutput> => {
    try {
      // 获取当前任务列表
      const state = context.stateStore.getState();
      const tasksMap = state.tasks || {};
      
      // 将对象转换为数组
      const tasks: TaskListItem[] = Object.values(tasksMap).map(task => ({
        id: task.id,
        status: task.status,
        description: task.description,
      }));

      console.log(`[TaskList] 查询到 ${tasks.length} 个任务`);

      return {
        tasks,
        message: tasks.length === 0
          ? '当前没有任务。使用 TaskCreate 工具创建新任务。'
          : `找到 ${tasks.length} 个任务。`,
      };
    } catch (error: any) {
      throw new Error(`TaskList 执行失败: ${error.message}`);
    }
  },
};
