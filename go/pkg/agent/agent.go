package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/fatih/color"

	"github.com/you-want/mini-cc/go/pkg/providers"
	"github.com/you-want/mini-cc/go/pkg/schema"
	"github.com/you-want/mini-cc/go/pkg/tools"
)

type Agent struct {
	Provider     providers.Provider
	Tools        []tools.Tool
	Messages     []schema.Message
	WorkspaceDir string
}

func NewAgent(provider providers.Provider, workspaceDir string) *Agent {
	return &Agent{
		Provider:     provider,
		WorkspaceDir: workspaceDir,
		Tools: []tools.Tool{
			tools.NewBashTool(),
			tools.NewFileReadTool(),
			tools.NewFileWriteTool(),
		},
		Messages: []schema.Message{
			{
				Role: schema.RoleSystem,
				Content: fmt.Sprintf(`You are mini-cc, an autonomous AI programming assistant.
You can execute bash commands, read and write files.
Important: When creating a NEW file, you MUST set require_new=true to prevent accidentally overwriting existing files.
Always explain your reasoning before making destructive changes.
You are currently working in the directory: %s
Any relative paths should be resolved relative to this directory.`, workspaceDir),
			},
		},
	}
}

func (a *Agent) getToolSchemas() []schema.ToolSchema {
	var schemas []schema.ToolSchema
	for _, t := range a.Tools {
		schemas = append(schemas, schema.ToolSchema{
			Type:     "function",
			Function: t.Schema(),
		})
	}
	return schemas
}

func (a *Agent) Run(ctx context.Context, prompt string) error {
	a.Messages = append(a.Messages, schema.Message{
		Role:    schema.RoleUser,
		Content: prompt,
	})

	for {
		// 发送请求，获取流式通道
		ch, err := a.Provider.GenerateStream(ctx, a.Messages, a.getToolSchemas())
		if err != nil {
			return fmt.Errorf("启动大模型生成失败: %v", err)
		}

		var fullContent string
		var toolCalls []schema.ToolCall

		// 设置终端打印颜色
		dimColor := color.New(color.FgHiBlack)     // 灰色，用于打印思考过程
		contentColor := color.New(color.FgHiGreen) // 绿色，用于打印最终回复

		// 监听流式事件
		for event := range ch {
			switch event.Type {
			case "error":
				return event.Error
			case "reasoning":
				dimColor.Print(event.Content) // 实时打印深度思考内容
			case "content":
				contentColor.Print(event.Content) // 实时打印正式回复
				fullContent += event.Content
			case "tool_calls":
				toolCalls = event.ToolCalls // 收集工具调用指令
			case "done":
				fmt.Println() // 生成结束，打印换行
			}
		}

		// 将大模型的回复存入上下文历史中
		msg := schema.Message{
			Role:    schema.RoleAssistant,
			Content: fullContent,
		}
		if len(toolCalls) > 0 {
			msg.ToolCalls = toolCalls
		}
		a.Messages = append(a.Messages, msg)

		if len(toolCalls) == 0 {
			break // 如果没有需要调用的工具，说明当前对话回合结束
		}

		// 开始处理工具调用（Tool Calls）
		for _, tc := range toolCalls {
			color.HiCyan("\n[调用工具] %s(%s)\n", tc.Function.Name, tc.Function.Arguments)

			var result string
			var toolErr error

			var args map[string]interface{}
			if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
				result = fmt.Sprintf("解析参数失败: %v", err)
			} else {
				toolFound := false
				for _, t := range a.Tools {
					if t.Name() == tc.Function.Name {
						toolFound = true
						tCtx := &tools.ToolContext{
							WorkspaceDir: a.WorkspaceDir,
							Ctx:          ctx,
						}
						// 执行具体的工具逻辑（例如跑 Bash 脚本、读写文件）
						result, toolErr = t.Execute(args, tCtx)
						break
					}
				}
				if !toolFound {
					result = fmt.Sprintf("错误: 未找到名为 '%s' 的工具", tc.Function.Name)
				} else if toolErr != nil {
					result = fmt.Sprintf("执行工具报错: %v", toolErr)
				}
			}

			// 将工具执行结果作为一条 tool 角色消息，添加到对话上下文中，反馈给大模型
			a.Messages = append(a.Messages, schema.Message{
				Role:       schema.RoleTool,
				Content:    result,
				ToolCallID: tc.ID,
			})

			// 截断过长的输出结果，防止刷屏
			if len(result) > 500 {
				dimColor.Printf("工具输出 (已截断): %s...\n", result[:500])
			} else {
				dimColor.Printf("工具输出: %s\n", result)
			}
		}
	}

	return nil
}
