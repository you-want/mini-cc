import { Tool, ToolUseContext } from './Tool';

/**
 * Todo 项接口
 */
export interface TodoItem {
  content: string;      // 任务内容
  status: 'pending' | 'in_progress' | 'completed';  // 任务状态
  activeForm: string;   // 任务的主动形式描述（用于进度跟踪）
}

/**
 * TodoWriteTool 输入参数
 */
interface TodoWriteInput {
  todos: TodoItem[];    // 更新后的 todo 列表
}

/**
 * TodoWriteTool 输出结果
 */
interface TodoWriteOutput {
  oldTodos: TodoItem[];  // 更新前的 todo 列表
  newTodos: TodoItem[];  // 更新后的 todo 列表
  message: string;       // 操作结果消息
}

/**
 * TodoWriteTool - 任务管理工具
 * 
 * 功能：创建、更新和管理会话级别的任务清单（Todo List）。
 * 
 * 使用场景：
 * - 处理复杂任务时，让 Agent 创建任务清单来跟踪进度
 * - 将大任务分解为多个小步骤
 * - 标记任务的完成状态（pending → in_progress → completed）
 * - 清理已完成的任务列表
 * 
 * 教学要点：
 * 1. 任务状态流转：pending（待办）→ in_progress（进行中）→ completed（已完成）
 * 2. 当所有任务都完成后，列表会自动清空
 * 3. activeForm 字段用于更自然地描述当前正在进行的任务
 * 4. 这是一个纯内存操作，不涉及文件系统
 * 
 * 示例用法：
 * ```json
 * {
 *   "todos": [
 *     {
 *       "content": "实现用户登录功能",
 *       "status": "in_progress",
 *       "activeForm": "正在实现用户登录功能"
 *     },
 *     {
 *       "content": "编写单元测试",
 *       "status": "pending",
 *       "activeForm": "编写单元测试"
 *     },
 *     {
 *       "content": "更新文档",
 *       "status": "completed",
 *       "activeForm": "更新文档"
 *     }
 *   ]
 * }
 * ```
 */
export const todoWriteTool: Tool<TodoWriteInput, TodoWriteOutput> = {
  name: 'TodoWrite',
  description: `
    创建或更新任务清单（Todo List），用于跟踪复杂任务的进度。
    
    适用场景：
    - 处理需要多个步骤的复杂任务
    - 需要将大任务分解为小步骤
    - 需要跟踪多个并行任务的进度
    
    任务状态：
    - pending: 待办任务，尚未开始
    - in_progress: 正在进行中的任务（建议同时只有一个任务处于此状态）
    - completed: 已完成的任务
    
    重要规则：
    1. 每次调用必须提供完整的 todo 列表（包括未改变的任务）
    2. 当所有任务都标记为 completed 时，列表会自动清空
    3. activeForm 应该用主动语态描述任务（如"正在编写测试代码"）
    4. 只在任务真正相关时才使用此工具，不要过度使用
    5. 定期清理已完成或不再相关的任务
    
    注意：这是一个内存操作，不会持久化到磁盘。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '更新后的完整任务列表',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '任务的具体内容描述',
              minLength: 1,
            },
            status: {
              type: 'string',
              description: '任务的当前状态',
              enum: ['pending', 'in_progress', 'completed'],
            },
            activeForm: {
              type: 'string',
              description: '任务的主动形式描述，用于进度展示',
              minLength: 1,
            },
          },
          required: ['content', 'status', 'activeForm'],
          additionalProperties: false,
        },
      },
    },
    required: ['todos'],
    additionalProperties: false,
  },
  execute: async (
    args: TodoWriteInput,
    context: ToolUseContext
  ): Promise<TodoWriteOutput> => {
    try {
      const { todos } = args;

      // 验证输入
      if (!todos || !Array.isArray(todos)) {
        throw new Error('todos 参数必须是数组');
      }

      // 验证每个 todo 项
      for (const todo of todos) {
        if (!todo.content || todo.content.trim().length === 0) {
          throw new Error('任务内容不能为空');
        }
        if (!todo.activeForm || todo.activeForm.trim().length === 0) {
          throw new Error('任务的 activeForm 不能为空');
        }
        if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
          throw new Error(`无效的任务状态: ${todo.status}`);
        }
      }

      // 获取旧的任务列表（从全局状态中读取）
      const state = context.stateStore.getState();
      const oldTodos: TodoItem[] = [];

      // 检查是否所有任务都已完成
      const allCompleted = todos.every(todo => todo.status === 'completed');
      
      // 如果所有任务都完成，清空列表；否则保存新列表
      const newTodos = allCompleted ? [] : todos;

      // 注意：由于 AppState 中没有 todos 字段，这里仅返回结果
      // 实际应用中可以扩展 AppState 来持久化 todos

      console.log(`[TodoWrite] 任务列表已更新: ${newTodos.length} 个任务${allCompleted ? '（已全部完成并清空）' : ''}`);

      return {
        oldTodos,
        newTodos,
        message: allCompleted
          ? '所有任务已完成，任务清单已清空。'
          : `任务清单已成功更新，当前有 ${newTodos.length} 个任务。请继续使用任务清单跟踪进度。`,
      };
    } catch (error: any) {
      throw new Error(`TodoWrite 执行失败: ${error.message}`);
    }
  },
};
