package tools

import (
	"context"

	"github.com/you-want/mini-cc/go/pkg/schema"
)

// ToolContext 承载了工具执行时所需的上下文环境变量
type ToolContext struct {
	WorkspaceDir string          // 当前工具被允许操作的沙盒工作区路径（例如：../test_file）
	Ctx          context.Context // 用于控制超时或中断（如响应 Ctrl+C）的上下文
}

// Tool 是所有自定义工具（Bash、FileWrite 等）都必须实现的标准接口
type Tool interface {
	Name() string                                                          // 工具名称，如 "bash"
	Schema() schema.ToolFunctionSchema                                     // 告诉大模型这个工具是干嘛的、需要传什么参数 (JSON Schema)
	Execute(args map[string]interface{}, ctx *ToolContext) (string, error) // 执行工具的核心逻辑
}
