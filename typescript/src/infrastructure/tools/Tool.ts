import { AppStateStore } from '../state/AppStateStore';
import { PermissionContext } from '../permissions';

/**
 * 工具使用上下文 (依赖注入模式)
 * 在每次执行工具时，由调用方（Agent）组装并传入。
 * 这样工具函数内部就不需要直接依赖全局变量，提升了可测试性和解耦度。
 */
export interface ToolUseContext {
  stateStore: AppStateStore;          // 全局状态管理器的引用
  permissionContext: PermissionContext; // 当前的权限策略和上下文
  workspaceDir: string;               // 当前工作目录，供文件操作或命令执行使用
}

/**
 * 工具接口定义 (工具驱动模式 Tool-Based Pattern)
 * 所有的工具（如执行命令、读文件、写文件等）都必须实现这个接口。
 * 从而保证 Agent 能够以统一的方式注册和调用它们。
 */
export interface Tool<Input = any, Output = any> {
  name: string;                       // 工具的名称，提供给大模型识别
  description: string;                // 工具的描述，告诉大模型这个工具是用来干嘛的
  inputSchema: any;                   // 工具的参数 JSON Schema，用于大模型生成结构化的参数
  execute(args: Input, context: ToolUseContext): Promise<Output>; // 实际的执行逻辑
}
