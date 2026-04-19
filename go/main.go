package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"minicc/src/buddy"
	"minicc/src/core"
	"minicc/src/core/providers"

	"github.com/joho/godotenv"
)

// main 是程序的入口函数
func main() {
	// 加载根目录下的 .env 环境变量文件
	godotenv.Load()

	// 检查是否传入了版本查询参数
	if len(os.Args) == 2 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Println("mini-cc go v1.0.0")
		os.Exit(0)
	}

	// 从环境变量中读取模型提供商名称，默认为 "openai"
	providerName := os.Getenv("PROVIDER")
	if providerName == "" {
		providerName = "openai"
	}

	var provider providers.LLMProvider

	// 目前 Go 版本仅支持兼容 OpenAI 接口的模型
	if strings.ToLower(providerName) == "openai" {
		apiKey := os.Getenv("OPENAI_API_KEY")
		baseURL := os.Getenv("OPENAI_BASE_URL")
		modelName := os.Getenv("MODEL_NAME")

		// 如果未指定模型名称，使用默认的模型（这里默认针对 Qwen 系列优化）
		if modelName == "" {
			modelName = "qwen3.6-plus"
		}

		// API Key 是必须的，如果没有配置则报错退出
		if apiKey == "" {
			fmt.Println("\033[31m错误：未设置 OPENAI_API_KEY 环境变量。\033[0m")
			os.Exit(1)
		}

		fmt.Printf("\033[90m[系统配置] 已选择 OpenAI 兼容模型，模型名称: %s\033[0m\n", modelName)
		// 实例化 OpenAI 提供商
		provider = providers.NewOpenAIProvider(apiKey, baseURL, modelName)
	} else {
		fmt.Println("\033[31mGo 版本目前仅支持 OpenAI 兼容接口。\033[0m")
		os.Exit(1)
	}

	// 实例化核心 Agent
	agent := core.NewAgent(provider)

	// 打印欢迎和提示信息
	fmt.Println("\033[1;34m\n=== 欢迎使用 mini-cc (Go) ===\n\033[0m")
	fmt.Println("\033[90m输入您的需求，我将为您编写代码或执行系统操作。\033[0m")
	fmt.Println("\033[90m键入 \"exit\" 或 \"quit\" 退出程序。\n\033[0m")

	// 初始化标准输入扫描器，用于读取用户终端输入
	scanner := bufio.NewScanner(os.Stdin)

	// 进入交互式对话的主循环
	for {
		fmt.Print("\033[36mmini-cc> \033[0m")
		// 读取用户输入，如果读取失败（如 Ctrl+D），则退出
		if !scanner.Scan() {
			fmt.Println("\033[32m\n再见！\033[0m")
			break
		}

		userInput := strings.TrimSpace(scanner.Text())
		// 忽略空输入
		if userInput == "" {
			continue
		}

		lowerInput := strings.ToLower(userInput)
		// 处理退出命令
		if lowerInput == "exit" || lowerInput == "quit" {
			fmt.Println("\033[32m再见！\033[0m")
			break
		}

		// 处理帮助命令
		if lowerInput == "/help" {
			fmt.Println("\033[36m\n=== 可用命令 ===\033[0m")
			fmt.Println("\033[90m  /help     - 显示此帮助信息\033[0m")
			fmt.Println("\033[90m  /clear    - 清空当前对话历史\033[0m")
			fmt.Println("\033[90m  /buddy    - 召唤电子宠物彩蛋\033[0m")
			fmt.Println("\033[90m  exit/quit - 退出程序\033[0m")
			fmt.Println("\033[36m==============\n\033[0m")
			continue
		}

		// 检查是否触发彩蛋系统
		if lowerInput == "/buddy" {
			buddy.SpawnBuddy("")
			continue
		}

		// 处理清空上下文命令，重新实例化 Provider 和 Agent 即可
		if lowerInput == "/clear" {
			provider = providers.NewOpenAIProvider(os.Getenv("OPENAI_API_KEY"), os.Getenv("OPENAI_BASE_URL"), os.Getenv("MODEL_NAME"))
			agent = core.NewAgent(provider)
			fmt.Println("\033[32m✓ 对话历史已清空。\033[0m")
			continue
		}

		fmt.Println("\033[2m\n[Agent] 已收到指令，正在思考中...\n\033[0m")

		// 定义文本响应的回调函数，用于在终端流式打印大模型的输出
		onTextResponse := func(text string, isThinking bool) {
			if isThinking {
				// 思考过程的内容使用灰色（弱化）显示
				fmt.Printf("\033[2m%s\033[0m", text)
			} else {
				// 正式回答的内容使用绿色显示
				fmt.Printf("\033[32m%s\033[0m", text)
			}
		}

		// 将用户输入交给 Agent 处理
		agent.Chat(userInput, onTextResponse)
		fmt.Println()
	}
}
