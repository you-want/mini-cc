package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"minicc/src/core"
	"minicc/src/core/providers"
)

func main() {
	godotenv.Load()

	if len(os.Args) == 2 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Println("mini-cc go v1.0.0")
		os.Exit(0)
	}

	providerName := os.Getenv("PROVIDER")
	if providerName == "" {
		providerName = "openai"
	}

	var provider providers.LLMProvider

	if strings.ToLower(providerName) == "openai" {
		apiKey := os.Getenv("OPENAI_API_KEY")
		baseURL := os.Getenv("OPENAI_BASE_URL")
		modelName := os.Getenv("MODEL_NAME")
		if modelName == "" {
			modelName = "qwen3.6-plus"
		}

		if apiKey == "" {
			fmt.Println("\033[31m错误：未设置 OPENAI_API_KEY 环境变量。\033[0m")
			os.Exit(1)
		}

		fmt.Printf("\033[90m[系统配置] 已选择 OpenAI 兼容模型，模型名称: %s\033[0m\n", modelName)
		provider = providers.NewOpenAIProvider(apiKey, baseURL, modelName)
	} else {
		fmt.Println("\033[31mGo 版本目前仅支持 OpenAI 兼容接口。\033[0m")
		os.Exit(1)
	}

	agent := core.NewAgent(provider)

	fmt.Println("\033[1;34m\n=== 欢迎使用 mini-cc (Go) ===\n\033[0m")
	fmt.Println("\033[90m输入您的需求，我将为您编写代码或执行系统操作。\033[0m")
	fmt.Println("\033[90m键入 \"exit\" 或 \"quit\" 退出程序。\n\033[0m")

	scanner := bufio.NewScanner(os.Stdin)

	for {
		fmt.Print("\033[36mmini-cc> \033[0m")
		if !scanner.Scan() {
			fmt.Println("\033[32m\n再见！\033[0m")
			break
		}

		userInput := strings.TrimSpace(scanner.Text())
		if userInput == "" {
			continue
		}

		lowerInput := strings.ToLower(userInput)
		if lowerInput == "exit" || lowerInput == "quit" {
			fmt.Println("\033[32m再见！\033[0m")
			break
		}

		if lowerInput == "/help" {
			fmt.Println("\033[36m\n=== 可用命令 ===\033[0m")
			fmt.Println("\033[90m  /help     - 显示此帮助信息\033[0m")
			fmt.Println("\033[90m  /clear    - 清空当前对话历史\033[0m")
			fmt.Println("\033[90m  exit/quit - 退出程序\033[0m")
			fmt.Println("\033[36m==============\n\033[0m")
			continue
		}

		if lowerInput == "/clear" {
			provider = providers.NewOpenAIProvider(os.Getenv("OPENAI_API_KEY"), os.Getenv("OPENAI_BASE_URL"), os.Getenv("MODEL_NAME"))
			agent = core.NewAgent(provider)
			fmt.Println("\033[32m✓ 对话历史已清空。\033[0m")
			continue
		}

		fmt.Println("\033[2m\n[Agent] 已收到指令，正在思考中...\n\033[0m")

		onTextResponse := func(text string, isThinking bool) {
			if isThinking {
				fmt.Printf("\033[2m%s\033[0m", text)
			} else {
				fmt.Printf("\033[32m%s\033[0m", text)
			}
		}

		agent.Chat(userInput, onTextResponse)
		fmt.Println()
	}
}