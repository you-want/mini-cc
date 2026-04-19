import { AppStateStore } from '../state/AppStateStore';
import { PermissionContext } from '../permissions';

export interface ToolUseContext {
  stateStore: AppStateStore;
  permissionContext: PermissionContext;
  workspaceDir: string;
}

export interface Tool<Input = any, Output = any> {
  name: string;
  description: string;
  inputSchema: any;
  execute(args: Input, context: ToolUseContext): Promise<Output>;
}
