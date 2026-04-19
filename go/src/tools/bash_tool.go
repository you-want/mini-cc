package tools

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type Tool struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
	Execute     func(args map[string]interface{}) (string, error)
}

func checkCommandSecurity(command string) (bool, string) {
	forbidden := []string{"rm -rf /", "mkfs", "dd if="}
	for _, f := range forbidden {
		if strings.Contains(command, f) {
			return false, fmt.Sprintf("包含高危操作: %s", f)
		}
	}
	return true, ""
}

var BashTool = Tool{
	Name: "BashTool",
	Description: `在本地系统执行 Bash/Shell 命令。
使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。
注意：
- 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。
- 始终使用绝对路径或基于当前工作目录的相对路径。
- 如果命令可能会产生大量输出，请使用 head 或 grep 进行截断和过滤。`,
	InputSchema: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"command": map[string]interface{}{
				"type":        "string",
				"description": "需要执行的 shell 命令",
			},
		},
		"required": []string{"command"},
	},
	Execute: func(args map[string]interface{}) (string, error) {
		cmdRaw, ok := args["command"]
		if !ok {
			return "执行命令时出错: command 不能为空", nil
		}
		command := cmdRaw.(string)

		isSafe, reason := checkCommandSecurity(command)
		if !isSafe {
			return fmt.Sprintf("命令执行被安全沙盒拒绝：%s", reason), nil
		}

		cmd := exec.Command("bash", "-c", command)
		cwd, _ := os.Getwd()
		cmd.Dir = cwd

		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Sprintf("[错误]\n%s\n[输出]\n%s", err.Error(), string(output)), nil
		}

		if len(output) == 0 {
			return "命令执行成功，但没有输出。", nil
		}
		return string(output), nil
	},
}