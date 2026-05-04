package security

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	// SAFE_COMMANDS are explicitly allowed commands even if they look suspicious
	SAFE_COMMANDS = []string{"cd", "ls", "pwd", "echo", "cat", "grep", "awk", "sed", "find", "head", "tail"}

	// DESTRUCTIVE_PATTERNS are regex patterns that indicate destructive operations
	DESTRUCTIVE_PATTERNS = []string{
		`rm\s+-rf\s+/\s*$`,                                  // rm -rf /
		`rm\s+-rf\s+\*\s*$`,                                 // rm -rf *
		`mkfs(?:\.[a-z0-9]+)?\s+/[a-zA-Z0-9/]+`,             // mkfs /dev/sda1
		`dd\s+if=/dev/(?:zero|urandom)\s+of=/[a-zA-Z0-9/]+`, // dd if=/dev/zero of=/dev/sda
		`>\s*/dev/sda`,                                      // > /dev/sda
		`:\(\)\{\s*:\|:&\s*\};:`,                            // fork bomb
		`>\s*/etc/[a-zA-Z0-9_.-]+`,                          // overwrite /etc files
	}

	// Wrapper regexes
	wrapperRegex = regexp.MustCompile(`^(?:sudo\s+|timeout\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d+[smhd]?\s+|watch\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d*\.?\d*\s+)+`)

	// Command substitution regexes
	backtickRegex    = regexp.MustCompile("`([^`]+)`")
	dollarParenRegex = regexp.MustCompile(`\$\(([^)]+)\)`)
)

func mustCompileRegexes() []*regexp.Regexp {
	var compiled []*regexp.Regexp
	for _, p := range DESTRUCTIVE_PATTERNS {
		compiled = append(compiled, regexp.MustCompile(p))
	}
	return compiled
}

var destructiveRegexes = mustCompileRegexes()

// IsDestructiveCommand checks if a command is potentially destructive
func IsDestructiveCommand(cmd string) bool {
	// First check basic destructive patterns
	for _, re := range destructiveRegexes {
		if re.MatchString(cmd) {
			return true
		}
	}

	// Then check command substitutions (e.g. echo $(rm -rf /))
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

// StripCommandWrappers removes wrappers like sudo, timeout, watch to get the base command
func StripCommandWrappers(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	for {
		newCmd := strings.TrimSpace(wrapperRegex.ReplaceAllString(cmd, ""))
		// Special handling for watch without flags
		newCmd = strings.TrimSpace(regexp.MustCompile(`^watch\s+`).ReplaceAllString(newCmd, ""))
		if newCmd == cmd {
			break
		}
		cmd = newCmd
	}
	return cmd
}

// CheckCommandSecurity evaluates a command and returns an error if it's unsafe
func CheckCommandSecurity(cmd string) error {
	if IsDestructiveCommand(cmd) {
		return fmt.Errorf("【严重警告：您的命令被系统强行终止！】\n您尝试执行的命令包含高危操作。安全沙盒已拦截此操作。")
	}

	baseCmd := StripCommandWrappers(cmd)
	if baseCmd == "" {
		return nil
	}

	// We can add whitelist logic here if needed
	// For now, we mainly rely on destructive patterns to match TS/Python implementation

	return nil
}
