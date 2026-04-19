package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sashabaranov/go-openai"
	"minicc/src/tools"
)

// LLMProvider 定义了大模型提供商的通用接口规范
type LLMProvider interface {
	SendMessage(userMessage string, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error)
	SendToolResults(results []map[string]interface{}, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error)
}

// OpenAIProvider 实现了 LLMProvider 接口，专门对接兼容 OpenAI 格式的模型服务
type OpenAIProvider struct {
	client   *openai.Client                 // OpenAI 客户端实例
	model    string                         // 使用的模型名称
	messages []openai.ChatCompletionMessage // 当前会话的完整历史消息
}

// NewOpenAIProvider 构造函数，初始化 OpenAI 客户端并注入系统提示词
func NewOpenAIProvider(apiKey string, baseURL string, model string) *OpenAIProvider {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	client := openai.NewClientWithConfig(config)

	// 定义 Agent 的系统人设（System Prompt）
	systemPrompt := "你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。"

	// 初始化消息列表，包含系统提示词
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemPrompt,
		},
	}

	return &OpenAIProvider{
		client:   client,
		model:    model,
		messages: messages,
	}
}

// getTools 将本地工具列表转换为 OpenAI 格式的工具定义数组
func (p *OpenAIProvider) getTools() []openai.Tool {
	var gTools []openai.Tool
	for _, t := range tools.Tools {
		gTools = append(gTools, openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.InputSchema,
			},
		})
	}
	return gTools
}

// createMessage 是与模型进行流式交互的核心方法
func (p *OpenAIProvider) createMessage(onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	// 构建对话请求体
	req := openai.ChatCompletionRequest{
		Model:       p.model,
		Messages:    p.messages,
		Tools:       p.getTools(),
		Temperature: 0.2,
		Stream:      true, // 开启流式输出
	}

	ctx := context.Background()
	// 发起流式请求
	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, err
	}
	defer stream.Close()

	var fullContent string
	toolCallsMap := make(map[int]openai.ToolCall)
	isContentStarted := false

	// 循环读取流式数据块 (chunks)
	for {
		response, err := stream.Recv()
		if err != nil {
			break // 流结束或发生错误
		}

		if len(response.Choices) == 0 {
			continue
		}

		delta := response.Choices[0].Delta

		// 1. 处理文本内容
		if delta.Content != "" {
			if !isContentStarted {
				onTextResponse("\n==================== 完整回复 ====================\n", false)
				isContentStarted = true
			}
			fullContent += delta.Content
			onTextResponse(delta.Content, false) // 实时打印到终端
		}

		// 2. 处理工具调用 (Tool Calls)
		// 由于流式输出中，工具的名称和参数是被切片分段发送的，所以需要拼接
		for _, tc := range delta.ToolCalls {
			idx := *tc.Index
			existing, ok := toolCallsMap[idx]
			if !ok {
				// 新的工具调用块
				id := tc.ID
				if id == "" {
					id = fmt.Sprintf("call_%d_%d", time.Now().UnixMilli(), idx)
				}
				toolCallsMap[idx] = openai.ToolCall{
					Index: tc.Index,
					ID:    id,
					Type:  openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				}
			} else {
				// 拼接后续的工具调用块（如参数片段）
				if tc.ID != "" {
					existing.ID = tc.ID
				}
				if tc.Function.Name != "" {
					existing.Function.Name += tc.Function.Name
				}
				if tc.Function.Arguments != "" {
					existing.Function.Arguments += tc.Function.Arguments
				}
				toolCallsMap[idx] = existing
			}
		}
	}

	onTextResponse("\n", false)

	// 将模型的回复保存到上下文历史中
	assistantMsg := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fullContent,
	}

	var finalToolCalls []map[string]interface{}
	var messageToolCalls []openai.ToolCall

	// 整理并解析收集完毕的工具调用
	for _, tc := range toolCallsMap {
		args := make(map[string]interface{})
		rawArgs := tc.Function.Arguments
		if rawArgs == "" {
			rawArgs = "{}"
		}
		
		// 尝试解析 JSON 参数
		err := json.Unmarshal([]byte(rawArgs), &args)
		if err != nil {
			fmt.Printf("\n[OpenAIProvider] 工具参数 JSON 解析失败。原始参数:\n%s\n", rawArgs)
			args["_parse_error"] = true
			args["_raw_arguments"] = rawArgs
		}

		finalToolCalls = append(finalToolCalls, map[string]interface{}{
			"id":   tc.ID,
			"name": tc.Function.Name,
			"args": args,
		})
		messageToolCalls = append(messageToolCalls, tc)
	}

	// 如果有工具调用，需要将其附加到助手消息中，以便保持上下文一致性
	if len(messageToolCalls) > 0 {
		assistantMsg.ToolCalls = messageToolCalls
	}

	p.messages = append(p.messages, assistantMsg)

	return map[string]interface{}{
		"text":      fullContent,
		"toolCalls": finalToolCalls,
	}, nil
}

// SendMessage 发送用户的第一条自然语言消息
func (p *OpenAIProvider) SendMessage(userMessage string, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	p.messages = append(p.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: userMessage,
	})
	return p.createMessage(onTextResponse)
}

// SendToolResults 发送工具执行的最终结果回模型
func (p *OpenAIProvider) SendToolResults(results []map[string]interface{}, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	for _, r := range results {
		contentStr := fmt.Sprintf("%v", r["result"])
		p.messages = append(p.messages, openai.ChatCompletionMessage{
			Role:       openai.ChatMessageRoleTool, // 角色必须是 tool
			ToolCallID: r["id"].(string),
			Content:    contentStr,
		})
	}
	return p.createMessage(onTextResponse)
}
