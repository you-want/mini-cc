package tools

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
)

var (
	dangerousPatterns = []*regexp.Regexp{
		regexp.MustCompile(`rm\s+-r[fF]?\s+/`),      // 禁止删除根目录
		regexp.MustCompile(`mkfs\.`),                // 禁止格式化文件系统
		regexp.MustCompile(`dd\s+if=.*of=/dev/sda`), // 禁止覆写磁盘
		regexp.MustCompile(`>\s*/dev/sd[a-z]`),      // 禁止直接写入块设备
	}

	commandSubstitutionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`\$\([^)]+\)`), // $(...)
		regexp.MustCompile("`[^`]+`"),     // `...`
	}
)

// Tool 定义了系统工具的通用结构体
type Tool struct {
	Name        string                                            // 工具的名称，例如 "BashTool"
	Description string                                            // 给大模型看的工具描述
	InputSchema map[string]interface{}                            // 工具参数的 JSON Schema 定义
	Execute     func(args map[string]interface{}) (string, error) // 实际执行逻辑的回调函数
}

// checkCommandSecurity 提供基础的安全沙盒检查，拦截危险命令
func checkCommandSecurity(command string) (bool, string) {
	// 1. 检查明显的高危破坏性命令
	for _, pattern := range dangerousPatterns {
		if pattern.MatchString(command) {
			return false, fmt.Sprintf("安全沙盒拦截：包含高危指令模式 (%s)", pattern.String())
		}
	}

	// 2. 拦截可能隐藏恶意的命令替换语法
	for _, pattern := range commandSubstitutionPatterns {
		if pattern.MatchString(command) {
			return false, fmt.Sprintf("安全沙盒拦截：禁止使用命令替换语法以防越权注入 (%s)", pattern.String())
		}
	}

	return true, ""
}

// BashTool 用于赋予大模型在本地执行 Shell/Bash 命令的能力
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
		// 提取并校验 command 参数
		cmdRaw, ok := args["command"]
		if !ok {
			return "执行命令时出错: command 不能为空", nil
		}
		command, ok := cmdRaw.(string)
		if !ok {
			return "执行命令时出错: command 必须是字符串", nil
		}

		// 执行前进行安全扫描
		isSafe, reason := checkCommandSecurity(command)
		if !isSafe {
			return fmt.Sprintf("命令执行被安全沙盒拒绝：%s", reason), nil
		}

		// 使用操作系统的 bash 运行命令
		cmd := exec.Command("bash", "-c", command)

		// 保证在当前项目根目录执行
		cwd, _ := os.Getwd()
		cmd.Dir = cwd

		// 执行命令并同时捕获标准输出和标准错误输出
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Sprintf("[错误]\n%s\n[输出]\n%s", err.Error(), string(output)), nil
		}

		// 如果没有输出（例如只运行了 touch 文件），给予一个友好的反馈提示
		if len(output) == 0 {
			return "命令执行成功，但没有输出。", nil
		}
		return string(output), nil
	},
}
