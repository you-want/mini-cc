package tools

import (
	"fmt"
	"os/exec"

	"minicc/pkg/schema"
	"minicc/pkg/security"
)

type BashTool struct{}

func NewBashTool() *BashTool {
	return &BashTool{}
}

func (t *BashTool) Name() string {
	return "bash"
}

func (t *BashTool) Schema() schema.ToolFunctionSchema {
	return schema.ToolFunctionSchema{
		Name:        t.Name(),
		Description: "Execute a bash command in the terminal. Use this to run scripts, interact with git, or any other command-line operations.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"command": map[string]interface{}{
					"type":        "string",
					"description": "The bash command to execute.",
				},
			},
			"required": []string{"command"},
		},
	}
}

func (t *BashTool) Execute(args map[string]interface{}, ctx *ToolContext) (string, error) {
	command, ok := args["command"].(string)
	if !ok {
		return "", fmt.Errorf("参数 'command' 缺失或无效")
	}

	// 在执行前进行安全沙盒检查（拦截 rm -rf / 等高危指令）
	if err := security.CheckCommandSecurity(command); err != nil {
		// 注意：安全拦截错误作为普通的文本输出返回给大模型，让它知道自己被拦截了，而不是作为致命系统错误抛出
		return err.Error(), nil 
	}

	// 组装系统执行命令
	cmd := exec.CommandContext(ctx.Ctx, "bash", "-c", command)
	// 将命令的工作目录绑定到沙盒隔离目录，防止它乱动外部文件
	cmd.Dir = ctx.WorkspaceDir

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Sprintf("命令执行失败: %v\n输出:\n%s", err, string(output)), nil
	}

	outStr := string(output)
	if outStr == "" {
		return "命令执行成功，但没有控制台输出。", nil
	}

	return outStr, nil
}
