package providers

import (
	"context"

	"minicc/pkg/schema"
)

type StreamEvent struct {
	Type             string            // "content", "reasoning", "tool_calls", "error", "done"
	Content          string            // for content or reasoning
	ToolCalls        []schema.ToolCall // accumulated tool calls when done
	Error            error
}

type Provider interface {
	GenerateStream(ctx context.Context, messages []schema.Message, tools []schema.ToolSchema) (<-chan StreamEvent, error)
}
