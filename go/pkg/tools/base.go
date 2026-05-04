package tools

import (
	"context"

	"minicc/pkg/schema"
)

type ToolContext struct {
	WorkspaceDir string
	Ctx          context.Context
}

type Tool interface {
	Name() string
	Schema() schema.ToolFunctionSchema
	Execute(args map[string]interface{}, ctx *ToolContext) (string, error)
}
