package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/sashabaranov/go-openai"
	"minicc/src/tools"
)

type LLMProvider interface {
	SendMessage(userMessage string, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error)
	SendToolResults(results []map[string]interface{}, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error)
}

type OpenAIProvider struct {
	client   *openai.Client
	model    string
	messages []openai.ChatCompletionMessage
}

func NewOpenAIProvider(apiKey string, baseURL string, model string) *OpenAIProvider {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	client := openai.NewClientWithConfig(config)

	systemPrompt := "你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。"

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

func (p *OpenAIProvider) createMessage(onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	req := openai.ChatCompletionRequest{
		Model:       p.model,
		Messages:    p.messages,
		Tools:       p.getTools(),
		Temperature: 0.2,
		Stream:      true,
	}

	ctx := context.Background()
	stream, err := p.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, err
	}
	defer stream.Close()

	var fullContent string
	toolCallsMap := make(map[int]openai.ToolCall)
	isContentStarted := false

	for {
		response, err := stream.Recv()
		if err != nil {
			break
		}

		if len(response.Choices) == 0 {
			continue
		}

		delta := response.Choices[0].Delta

		if delta.Content != "" {
			if !isContentStarted {
				onTextResponse("\n==================== 完整回复 ====================\n", false)
				isContentStarted = true
			}
			fullContent += delta.Content
			onTextResponse(delta.Content, false)
		}

		for _, tc := range delta.ToolCalls {
			idx := *tc.Index
			existing, ok := toolCallsMap[idx]
			if !ok {
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

	assistantMsg := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fullContent,
	}

	var finalToolCalls []map[string]interface{}
	var messageToolCalls []openai.ToolCall

	for _, tc := range toolCallsMap {
		args := make(map[string]interface{})
		rawArgs := tc.Function.Arguments
		if rawArgs == "" {
			rawArgs = "{}"
		}
		
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

	if len(messageToolCalls) > 0 {
		assistantMsg.ToolCalls = messageToolCalls
	}

	p.messages = append(p.messages, assistantMsg)

	return map[string]interface{}{
		"text":      fullContent,
		"toolCalls": finalToolCalls,
	}, nil
}

func (p *OpenAIProvider) SendMessage(userMessage string, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	p.messages = append(p.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: userMessage,
	})
	return p.createMessage(onTextResponse)
}

func (p *OpenAIProvider) SendToolResults(results []map[string]interface{}, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	for _, r := range results {
		contentStr := fmt.Sprintf("%v", r["result"])
		p.messages = append(p.messages, openai.ChatCompletionMessage{
			Role:       openai.ChatMessageRoleTool,
			ToolCallID: r["id"].(string),
			Content:    contentStr,
		})
	}
	return p.createMessage(onTextResponse)
}