package security

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	// SAFE_COMMANDS 是即使看起来可疑也明确允许的白名单命令（当前版本未严格启用白名单模式，备用）
	SAFE_COMMANDS = []string{"cd", "ls", "pwd", "echo", "cat", "grep", "awk", "sed", "find", "head", "tail"}

	// DESTRUCTIVE_PATTERNS 是用来匹配破坏性操作（如删库跑路）的黑名单正则表达式
	DESTRUCTIVE_PATTERNS = []string{
		`rm\s+-rf\s+/\s*$`,                                  // 拦截: rm -rf /
		`rm\s+-rf\s+\*\s*$`,                                 // 拦截: rm -rf *
		`mkfs(?:\.[a-z0-9]+)?\s+/[a-zA-Z0-9/]+`,             // 拦截: 格式化硬盘 mkfs /dev/sda1
		`dd\s+if=/dev/(?:zero|urandom)\s+of=/[a-zA-Z0-9/]+`, // 拦截: 磁盘覆写 dd if=/dev/zero of=/dev/sda
		`>\s*/dev/sda`,                                      // 拦截: 直接重定向到设备
		`:\(\)\{\s*:\|:&\s*\};:`,                            // 拦截: fork bomb (经典的系统崩溃炸弹)
		`>\s*/etc/[a-zA-Z0-9_.-]+`,                          // 拦截: 覆盖系统核心配置 /etc
	}

	// wrapperRegex 用于匹配命令外层的包装器，如 sudo, timeout 10s 等
	wrapperRegex = regexp.MustCompile(`^(?:sudo\s+|timeout\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d+[smhd]?\s+|watch\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d*\.?\d*\s+)+`)

	// Command substitution regexes 用于匹配命令替换（防止黑客把危险命令包在子 Shell 里）
	backtickRegex    = regexp.MustCompile("`([^`]+)`")     // 匹配: `rm -rf /`
	dollarParenRegex = regexp.MustCompile(`\$\(([^)]+)\)`) // 匹配: $(rm -rf /)
)

func mustCompileRegexes() []*regexp.Regexp {
	var compiled []*regexp.Regexp
	for _, p := range DESTRUCTIVE_PATTERNS {
		compiled = append(compiled, regexp.MustCompile(p))
	}
	return compiled
}

var destructiveRegexes = mustCompileRegexes()

// IsDestructiveCommand 检查命令是否包含潜在的破坏性操作
func IsDestructiveCommand(cmd string) bool {
	// 第一步：检查基础的黑名单正则
	for _, re := range destructiveRegexes {
		if re.MatchString(cmd) {
			return true
		}
	}

	// 第二步：检查是否存在子 Shell 嵌套（命令替换），比如：echo $(rm -rf /)
	// 如果提取到了子命令，则递归调用自身进行安全检查
	if matches := backtickRegex.FindAllStringSubmatch(cmd, -1); matches != nil {
		for _, match := range matches {
			if len(match) > 1 && IsDestructiveCommand(match[1]) {
				return true
			}
		}
	}

	if matches := dollarParenRegex.FindAllStringSubmatch(cmd, -1); matches != nil {
		for _, match := range matches {
			if len(match) > 1 && IsDestructiveCommand(match[1]) {
				return true
			}
		}
	}

	return false
}

// StripCommandWrappers 剥离外层包装命令（如 sudo、timeout、watch），提取核心命令用于安全检查
func StripCommandWrappers(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	// 使用 for 循环是为了应对嵌套包装，例如 "sudo timeout 10 watch ls"
	for {
		newCmd := strings.TrimSpace(wrapperRegex.ReplaceAllString(cmd, ""))
		// Special handling for watch without flags
		newCmd = strings.TrimSpace(regexp.MustCompile(`^watch\s+`).ReplaceAllString(newCmd, ""))
		if newCmd == cmd {
			break // 当不再有包装命令被替换掉时，退出循环
		}
		cmd = newCmd
	}
	return cmd
}

// CheckCommandSecurity 是对外暴露的统一安全检查入口
func CheckCommandSecurity(cmd string) error {
	if IsDestructiveCommand(cmd) {
		return fmt.Errorf("【严重警告：您的命令被系统强行终止！】\n您尝试执行的命令包含高危操作。安全沙盒已拦截此操作。")
	}

	baseCmd := StripCommandWrappers(cmd)
	if baseCmd == "" {
		return nil
	}

	// 如果有需要，可以在这里增加更严格的白名单逻辑（例如只允许 SAFE_COMMANDS）
	// 目前为了保持和 TS/Python 版本逻辑对齐，我们主要依赖黑名单正则来拦截

	return nil
}
