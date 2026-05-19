import { Tool, ToolUseContext } from './Tool';
import { TaskState } from '../state/AppStateStore';
import * as crypto from 'crypto';

/**
 * TaskCreateTool 输入参数
 */
interface TaskCreateInput {
  subject: string;        // 任务标题
  description: string;    // 任务描述
}

/**
 * TaskCreateTool 输出结果
 */
interface TaskCreateOutput {
  task: {
    id: string;
    subject: string;
  };
  message: string;
}

/**
 * 生成唯一的任务 ID
 */
function generateTaskId(): string {
  return `task_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * TaskCreateTool - 任务创建工具
 * 
 * 功能：在任务列表中创建新任务，支持后台任务管理和多 Agent 协作。
 * 
 * 使用场景：
 * - 将复杂工作分解为可独立执行的任务
 * - 为子 Agent 分配具体工作
 * - 创建需要异步执行的任务
 * - 建立任务依赖关系
 * 
 * 教学要点：
 * 1. 任务与 Todo 的区别：
 *    - Todo: 轻量级清单，适合单会话内的简单任务跟踪
 *    - Task: 重量级任务，支持持久化、所有权、依赖关系等高级特性
 * 2. 新创建的任务默认状态为 'pending'，没有所有者
 * 3. 使用 TaskUpdate 工具可以设置任务的所有者和状态
 * 4. 任务 ID 是全局唯一的，可用于后续引用
 * 5. metadata 字段可以附加任意额外信息
 * 
 * 示例用法：
 * ```json
 * {
 *   "subject": "实现用户认证模块",
 *   "description": "创建 JWT 认证中间件，包括登录、登出和 token 刷新功能",
 *   "activeForm": "正在实现用户认证模块",
 *   "metadata": {
 *     "priority": "high",
 *     "estimatedTime": "2h"
 *   }
 * }
 * ```
 */
export const taskCreateTool: Tool<TaskCreateInput, TaskCreateOutput> = {
  name: 'TaskCreate',
  description: `
    在任务列表中创建一个新任务。
    
    适用场景：
    - 需要将大任务分解为多个可独立执行的子任务
    - 需要为不同的 Agent 或团队成员分配工作
    - 需要跟踪具有依赖关系的复杂工作流程
    - 需要创建可以异步执行的任务
    
    与 TodoWrite 的区别：
    - TodoWrite: 轻量级任务清单，适合单会话内的简单跟踪
    - TaskCreate: 重量级任务系统，支持持久化、所有权、依赖关系等
    
    重要规则：
    1. subject 应该简洁明了（建议不超过 50 个字符）
    2. description 应该详细说明任务要求和预期结果
    3. activeForm 用现在进行时描述（如"正在编写测试代码"）
    4. 新任务默认状态为 'pending'，没有所有者
    5. 使用 TaskUpdate 工具来设置任务的所有者、状态和依赖关系
    6. 可以通过 metadata 附加优先级、预估时间等额外信息
    
    注意：
    - 任务创建后不会自动开始执行
    - 需要使用 TaskUpdate 设置 owner 来认领任务
    - 任务列表可以通过 TaskList 工具查看
  `,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '任务的简短标题（建议不超过 50 个字符）',
        minLength: 1,
        maxLength: 100,
      },
      description: {
        type: 'string',
        description: '任务的详细描述，说明需要做什么以及预期结果',
        minLength: 1,
      },
      activeForm: {
        type: 'string',
        description: '任务的主动形式描述，用于进度展示（如"正在编写测试代码"）',
        minLength: 1,
      },
      metadata: {
        type: 'object',
        description: '可选的元数据，可以附加任意键值对信息（如优先级、预估时间等）',
        additionalProperties: true,
      },
    },
    required: ['subject', 'description'],
    additionalProperties: false,
  },
  execute: async (
    args: TaskCreateInput,
    context: ToolUseContext
  ): Promise<TaskCreateOutput> => {
    try {
      const { subject, description } = args;

      // 验证输入
      if (!subject || subject.trim().length === 0) {
        throw new Error('任务标题不能为空');
      }
      if (!description || description.trim().length === 0) {
        throw new Error('任务描述不能为空');
      }
      if (subject.length > 100) {
        throw new Error('任务标题不能超过 100 个字符');
      }

      // 生成唯一的任务 ID
      const taskId = generateTaskId();

      // 创建任务对象（符合 TaskState 接口）
      const newTask: TaskState = {
        id: taskId,
        status: 'pending',
        description: `${subject.trim()}\n\n${description.trim()}`,
      };

      // 获取当前任务列表
      const state = context.stateStore.getState();
      const existingTasks = state.tasks || {};

      // 添加新任务到列表
      const updatedTasks = {
        ...existingTasks,
        [taskId]: newTask,
      };

      // 更新全局状态
      context.stateStore.setState({
        tasks: updatedTasks,
      });

      console.log(`[TaskCreate] 创建新任务: ${taskId} - ${subject}`);

      return {
        task: {
          id: taskId,
          subject: subject.trim(),
        },
        message: `任务 #${taskId} 已成功创建: ${subject}。使用 TaskUpdate 工具设置任务的所有者和状态。`,
      };
    } catch (error: any) {
      throw new Error(`TaskCreate 执行失败: ${error.message}`);
    }
  },
};
