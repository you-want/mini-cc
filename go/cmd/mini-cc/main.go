package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
	"github.com/joho/godotenv"
	"github.com/peterh/liner"

	"minicc/pkg/agent"
	"minicc/pkg/providers"
)

func getWorkspaceDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return filepath.Join(cwd, "../test_file")
}

func printBanner() {
	version := "1.0.0 (Go Edition)"

	userName := "developer"
	if envUser := os.Getenv("USER"); envUser != "" {
		userName = envUser
	}

	cwd, _ := os.Getwd()
	homeDir, _ := os.UserHomeDir()
	displayCwd := cwd
	if strings.HasPrefix(cwd, homeDir) {
		displayCwd = "~" + cwd[len(homeDir):]
	}

	modelName := os.Getenv("MODEL_NAME")
	if modelName == "" {
		modelName = "qwen3.6-plus"
	}
	providerDisplay := "OpenAI / Compatible"

	truncate := func(s string, l int) string {
		runes := []rune(s)
		if len(runes) > l {
			return string(runes[:l-3]) + "..."
		}
		return s
	}

	uDisp := truncate(userName, 15)
	mDisp := truncate(modelName, 22)
	cDisp := truncate(displayCwd, 35)

	cBox := "\033[38;2;204;255;0m"
	cTitle := "\033[36m\033[1m"
	cCyan := "\033[36m"
	cBlue := "\033[34m\033[4m"
	cGray := "\033[90m"
	cYellow := "\033[33m"
	cBg := "\033[48;2;5;5;5m"
	res := "\033[0m"

	type line struct {
		rawL, colL, rawR, colR string
	}

	lines := []line{
		{fmt.Sprintf("mini-cc CLI %s", version), fmt.Sprintf("%smini-cc CLI %s%s", cTitle, version, res), "", ""},
		{"▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄", fmt.Sprintf("%s▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄%s", cBox, res), "", ""},
		{"█               █", fmt.Sprintf("%s█%s               %s%s█%s", cBox, cBg, res, cBox, res), "Announcements", fmt.Sprintf("%sAnnouncements%s", cTitle, res)},
		{"█  cc       ■   █", fmt.Sprintf("%s█%s  %s\033[1mcc%s%s       \033[38;2;229;229;229m■%s%s   %s%s█%s", cBox, cBg, cBox, res, cBg, res, cBg, res, cBox, res), "Try MINI-CC", "Try MINI-CC"},
		{"█               █", fmt.Sprintf("%s█%s               %s%s█%s", cBox, cBg, res, cBox, res), "Website: https://mini-cc.raingpt.top/", fmt.Sprintf("Website: %shttps://mini-cc.raingpt.top/%s", cBlue, res)},
		{"▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀", fmt.Sprintf("%s▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀%s", cBox, res), "Github: https://github.com/you-want/mini-cc", fmt.Sprintf("Github: %shttps://github.com/you-want/mini-cc%s", cBlue, res)},
		{"", "", "", ""},
		{fmt.Sprintf("Welcome back, %s", uDisp), fmt.Sprintf("Welcome back, %s%s%s", cCyan, uDisp, res), "────────────────────────────────────────", fmt.Sprintf("%s────────────────────────────────────────%s", cGray, res)},
		{fmt.Sprintf("Model: %s", mDisp), fmt.Sprintf("Model: %s%s%s", cCyan, mDisp, res), "Did you know?", fmt.Sprintf("%sDid you know?%s", cTitle, res)},
		{fmt.Sprintf("Provider: %s", providerDisplay), fmt.Sprintf("Provider: %s%s%s", cCyan, providerDisplay, res), "You can use /buddy to summon a digital pet!", fmt.Sprintf("You can use %s/buddy%s to summon a digital pet!", cYellow, res)},
		{cDisp, fmt.Sprintf("%s%s%s", cGray, cDisp, res), "Type /clear to clear context history.", fmt.Sprintf("Type %s/clear%s to clear context history.", cYellow, res)},
	}

	fmt.Printf("%s╭────────────────────────────────────────────────────────────────────────────────────╮%s\n", cBox, res)
	for _, l := range lines {
		padL := 39 - len([]rune(l.rawL))
		if padL < 0 {
			padL = 0
		}
		padR := 43 - len([]rune(l.rawR))
		if padR < 0 {
			padR = 0
		}
		fmt.Printf("%s│%s %s%s%s%s %s│%s\n", cBox, res, l.colL, strings.Repeat(" ", padL), l.colR, strings.Repeat(" ", padR), cBox, res)
	}
	fmt.Printf("%s╰────────────────────────────────────────────────────────────────────────────────────╯%s\n\n", cBox, res)
}

func main() {
	// 尝试加载环境变量：先读取当前目录的 .env，再兜底读取用户主目录的全局配置 .mini-cc-env
	_ = godotenv.Load(".env")
	home, _ := os.UserHomeDir()
	_ = godotenv.Load(filepath.Join(home, ".mini-cc-env"))

	// 检查是否配置了必要的 API Key
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		color.Red("错误：未设置 OPENAI_API_KEY 环境变量。请在 .env 中配置。")
		os.Exit(1)
	}

	baseURL := os.Getenv("OPENAI_BASE_URL")
	model := os.Getenv("MODEL_NAME")
	if model == "" {
		model = "qwen3.6-plus" // 如果未设置，使用默认模型
	}

	// 实例化大模型 Provider，这里使用 OpenAI 兼容格式
	provider := providers.NewOpenAIProvider(baseURL, apiKey, model)

	// 获取并创建工作区目录（沙盒目录 test_file），防止大模型直接修改源码
	workspaceDir := getWorkspaceDir()
	os.MkdirAll(workspaceDir, 0755)

	// 实例化核心 Agent
	ag := agent.NewAgent(provider, workspaceDir)

	// 打印 ASCII 欢迎横幅
	printBanner()

	// 初始化 liner 终端交互库，用于实现类似 Bash 的命令行输入体验（支持上下键看历史、光标移动等）
	line := liner.NewLiner()
	defer line.Close()

	// 允许通过 Ctrl+C 终止输入（不直接退出程序，而是抛出错误方便我们捕获）
	line.SetCtrlCAborts(true)
	// 开启多行模式，允许粘贴长文本
	line.SetMultiLineMode(true)

	// 这是一个非常关键的修复：
	// 在中文（CJK）环境下，像 “（”、“）”、“：” 这种全角标点符号在终端中占据 2 个字符宽度。
	// 但底层库 go-runewidth 默认把它们当做 1 个宽度（Ambiguous width 歧义宽度）。
	// 强行设置 RUNEWIDTH_EASTASIAN=1 可以让底层正确识别全角标点，彻底解决终端光标错位、文字重叠的问题。
	os.Setenv("RUNEWIDTH_EASTASIAN", "1")

	// 加载历史输入记录，让用户可以用 上/下 方向键找回之前打过的字
	historyFile := filepath.Join(home, ".mini-cc_history")
	if f, err := os.Open(historyFile); err == nil {
		line.ReadHistory(f)
		f.Close()
	}

	// 进入主交互循环（REPL）
	for {
		// 注意：Prompt 必须是纯文本，不能带 \033 颜色代码，否则 liner 会报错 ErrInvalidPrompt
		input, err := line.Prompt("mini-cc> ")

		// 捕获 Ctrl+C 或 Ctrl+D(EOF)
		if err == liner.ErrPromptAborted || err == io.EOF {
			color.HiGreen("\n再见！")
			break
		} else if err != nil {
			color.Red("读取输入时发生错误: %v", err)
			break
		}

		input = strings.TrimSpace(input)
		if input == "" {
			continue
		}

		// 将用户输入保存到历史记录文件中
		line.AppendHistory(input)
		if f, err := os.Create(historyFile); err == nil {
			line.WriteHistory(f)
			f.Close()
		}

		// 拦截内置退出命令
		if input == "/exit" || input == "quit" || input == "exit" {
			color.HiGreen("再见！")
			break
		}

		// 拦截清空上下文命令，做法是重新实例化一个干净的 Agent
		if input == "/clear" {
			ag = agent.NewAgent(provider, workspaceDir)
			color.HiYellow("上下文已清空。")
			continue
		}

		// 为本次执行创建一个可以被取消的 Context
		ctx, cancel := context.WithCancel(context.Background())

		// 将用户输入交给 Agent 进行推理和工具调用
		err = ag.Run(ctx, input)
		if err != nil {
			color.Red("错误: %v\n", err)
		}

		cancel()
	}
}
