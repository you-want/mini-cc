package core

import (
	"fmt"

	"minicc/src/core/providers"
	"minicc/src/tools"
)

// Agent 结构体，封装了模型提供商，负责协调模型交互与工具执行
type Agent struct {
	provider providers.LLMProvider
}

// NewAgent 构造函数，返回一个初始化好的 Agent 实例
func NewAgent(provider providers.LLMProvider) *Agent {
	return &Agent{provider: provider}
}

// handleToolCalls 负责解析并执行大模型返回的工具调用指令
func (a *Agent) handleToolCalls(toolCalls []map[string]interface{}) []map[string]interface{} {
	var results []map[string]interface{}

	// 遍历所有大模型请求调用的工具
	for _, call := range toolCalls {
		id := call["id"].(string)
		name := call["name"].(string)
		args := call["args"].(map[string]interface{})

		// 检查工具参数是否解析失败（JSON 格式错误等）
		if args["_parse_error"] != nil {
			results = append(results, map[string]interface{}{
				"id":      id,
				"name":    name,
				"result":  fmt.Sprintf("[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n你输出的原始参数为:\n%s", args["_raw_arguments"]),
				"isError": true,
			})
			continue
		}

		// 根据工具名称在已注册的工具列表中查找对应工具
		var tool *tools.Tool
		for _, t := range tools.Tools {
			if t.Name == name {
				tool = &t
				break
			}
		}

		// 如果大模型幻觉输出了不存在的工具名称，返回错误提示给模型
		if tool == nil {
			fmt.Printf("\033[31m[Agent] 未知工具: %s\033[0m\n", name)
			results = append(results, map[string]interface{}{
				"id":      id,
				"name":    name,
				"result":  fmt.Sprintf("未知的工具调用: %s", name),
				"isError": true,
			})
			continue
		}

		fmt.Printf("\033[36m▶ [Agent] 正在调用工具: %s ...\033[0m\n", name)

		// 实际执行工具逻辑
		result, err := tool.Execute(args)

		fmt.Printf("\033[32m✔ [Agent] 工具 %s 执行完毕。\033[0m\n", name)

		// 为了防止单次工具输出的内容过长（例如 cat 了一个极大的日志文件），导致 Token 超限
		// 这里对超过 8000 字符的输出进行截断保护
		if len(result) > 8000 {
			fmt.Printf("\n[上下文瘦身] 工具 %s 返回结果过长 (%d 字符)，已触发截断。\n", name, len(result))
			result = result[:8000] + "\n\n...[由于内容过长，已被截断]..."
		}

		// 记录工具的执行结果或报错信息，准备在下一轮反馈给大模型
		if err != nil {
			results = append(results, map[string]interface{}{
				"id":      id,
				"name":    name,
				"result":  fmt.Sprintf("执行工具 %s 时出错: %v", name, err),
				"isError": true,
			})
		} else {
			results = append(results, map[string]interface{}{
				"id":      id,
				"name":    name,
				"result":  result,
				"isError": false,
			})
		}
	}

	return results
}

// Chat 是处理单次用户输入并开启 Agent 思考循环的核心方法
func (a *Agent) Chat(userMessage string, onTextResponse func(text string, isThinking bool)) {
	// 第一轮：将用户的消息发送给大模型
	response, err := a.provider.SendMessage(userMessage, onTextResponse)
	if err != nil {
		fmt.Printf("\n[Agent 报错] %v\n", err)
		return
	}

	loopCount := 0
	// 设置最大自动调用循环次数，防止大模型陷入死循环
	maxLoops := 5

	// 进入工具调用的事件循环
	for {
		toolCallsRaw := response["toolCalls"]
		// 如果大模型没有返回任何工具调用需求，说明任务已完成或模型决定直接回复
		if toolCallsRaw == nil {
			break
		}

		toolCalls := toolCallsRaw.([]map[string]interface{})
		if len(toolCalls) == 0 {
			break
		}

		loopCount++
		// 检查是否超过最大循环次数
		if loopCount > maxLoops {
			fmt.Printf("\n\033[33m[Agent] 工具调用循环次数过多 (%d)，为防止无限循环，已强制终止。\033[0m\n", loopCount)
			break
		}

		fmt.Printf("\n\033[33m[Agent] 收到大模型指令，准备执行 %d 个工具调用... (第 %d 轮)\033[0m\n", len(toolCalls), loopCount)

		// 批量执行本次模型请求的所有工具
		toolResults := a.handleToolCalls(toolCalls)

		fmt.Printf("\n\033[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\033[0m\n\n")

		// 将所有工具的执行结果发送回大模型，继续下一轮思考
		response, err = a.provider.SendToolResults(toolResults, onTextResponse)
		if err != nil {
			fmt.Printf("\n[Agent 报错] %v\n", err)
			return
		}
	}
}
