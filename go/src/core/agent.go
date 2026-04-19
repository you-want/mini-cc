package core

import (
	"fmt"

	"minicc/src/core/providers"
	"minicc/src/tools"
)

type Agent struct {
	provider providers.LLMProvider
}

func NewAgent(provider providers.LLMProvider) *Agent {
	return &Agent{provider: provider}
}

func (a *Agent) handleToolCalls(toolCalls []map[string]interface{}) []map[string]interface{} {
	var results []map[string]interface{}

	for _, call := range toolCalls {
		id := call["id"].(string)
		name := call["name"].(string)
		args := call["args"].(map[string]interface{})

		if args["_parse_error"] != nil {
			results = append(results, map[string]interface{}{
				"id":      id,
				"name":    name,
				"result":  fmt.Sprintf("[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n你输出的原始参数为:\n%s", args["_raw_arguments"]),
				"isError": true,
			})
			continue
		}

		var tool *tools.Tool
		for _, t := range tools.Tools {
			if t.Name == name {
				tool = &t
				break
			}
		}

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
		result, err := tool.Execute(args)
		fmt.Printf("\033[32m✔ [Agent] 工具 %s 执行完毕。\033[0m\n", name)

		if len(result) > 8000 {
			fmt.Printf("\n[上下文瘦身] 工具 %s 返回结果过长 (%d 字符)，已触发截断。\n", name, len(result))
			result = result[:8000] + "\n\n...[由于内容过长，已被截断]..."
		}

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

func (a *Agent) Chat(userMessage string, onTextResponse func(text string, isThinking bool)) {
	response, err := a.provider.SendMessage(userMessage, onTextResponse)
	if err != nil {
		fmt.Printf("\n[Agent 报错] %v\n", err)
		return
	}

	loopCount := 0
	maxLoops := 5

	for {
		toolCallsRaw := response["toolCalls"]
		if toolCallsRaw == nil {
			break
		}

		toolCalls := toolCallsRaw.([]map[string]interface{})
		if len(toolCalls) == 0 {
			break
		}

		loopCount++
		if loopCount > maxLoops {
			fmt.Printf("\n\033[33m[Agent] 工具调用循环次数过多 (%d)，为防止无限循环，已强制终止。\033[0m\n", loopCount)
			break
		}

		fmt.Printf("\n\033[33m[Agent] 收到大模型指令，准备执行 %d 个工具调用... (第 %d 轮)\033[0m\n", len(toolCalls), loopCount)
		toolResults := a.handleToolCalls(toolCalls)

		fmt.Printf("\n\033[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\033[0m\n\n")
		response, err = a.provider.SendToolResults(toolResults, onTextResponse)
		if err != nil {
			fmt.Printf("\n[Agent 报错] %v\n", err)
			return
		}
	}
}