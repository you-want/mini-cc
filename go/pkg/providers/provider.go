package providers

import (
	"context"

	"github.com/you-want/mini-cc/go/pkg/schema"
)

// StreamEvent 定义了大模型流式输出过程中的每一个事件片段（Chunk）
type StreamEvent struct {
	Type      string            // 事件类型，如："content"(正文), "reasoning"(思考过程), "tool_calls"(工具调用), "error", "done"
	Content   string            // 当类型为 content 或 reasoning 时，存放打字机追加的文本片段
	ToolCalls []schema.ToolCall // 当类型为 tool_calls 时，存放完整组装好的工具调用指令
	Error     error             // 当类型为 error 时存放报错信息
}

// Provider 是所有底层大模型驱动（OpenAI、Anthropic等）必须实现的标准接口
type Provider interface {
	// GenerateStream 接收当前对话上下文和可用工具列表，返回一个用于实时接收流式事件的只读 Channel
	GenerateStream(ctx context.Context, messages []schema.Message, tools []schema.ToolSchema) (<-chan StreamEvent, error)
}
