package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/you-want/mini-cc/go/pkg/schema"
)

// OpenAIProvider 实现了与 OpenAI 以及任何兼容 OpenAI 接口（如 Qwen、DeepSeek）的后端进行通信
type OpenAIProvider struct {
	BaseURL string // API 地址
	APIKey  string // 鉴权秘钥
	Model   string // 使用的模型名称
}

func NewOpenAIProvider(baseURL, apiKey, model string) *OpenAIProvider {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1" // 默认使用 OpenAI 官方地址
	}
	return &OpenAIProvider{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Model:   model,
	}
}

// GenerateStream 向大模型发送请求，并返回一个 channel 用于实时接收流式数据
func (p *OpenAIProvider) GenerateStream(ctx context.Context, messages []schema.Message, tools []schema.ToolSchema) (<-chan StreamEvent, error) {
	ch := make(chan StreamEvent)

	// 组装请求体
	reqBody := map[string]interface{}{
		"model":    p.Model,
		"messages": messages,
		"stream":   true, // 开启打字机流式输出
	}

	// 注入可用工具列表
	if len(tools) > 0 {
		reqBody["tools"] = tools
	}

	// 针对千问（Qwen）模型的特殊处理：为了支持流式模式下的 reasoning_content（思考过程）
	if strings.Contains(strings.ToLower(p.Model), "qwen") {
		reqBody["stream_options"] = map[string]interface{}{
			"include_usage": true,
		}
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("序列化请求体失败: %v", err)
	}

	// 创建 HTTP POST 请求
	req, err := http.NewRequestWithContext(ctx, "POST", p.BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.APIKey)

	client := &http.Client{}

	// 启动一个后台 Goroutine 去发起网络请求并解析 SSE 流
	go func() {
		defer close(ch) // 确保在协程退出时关闭通道，防止死锁

		resp, err := client.Do(req)
		if err != nil {
			ch <- StreamEvent{Type: "error", Error: fmt.Errorf("网络请求失败: %v", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// 发生鉴权错误或服务端错误时，读取完整的错误信息返回
			var errBody bytes.Buffer
			_, _ = errBody.ReadFrom(resp.Body)
			ch <- StreamEvent{Type: "error", Error: fmt.Errorf("API 报错 (状态码 %d): %s", resp.StatusCode, errBody.String())}
			return
		}

		// 使用 Scanner 逐行读取 Server-Sent Events (SSE) 数据流
		scanner := bufio.NewScanner(resp.Body)

		var currentToolCalls []schema.ToolCall

		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			// SSE 协议标准：每条数据以 "data: " 开头
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break // 流式输出正常结束
			}

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content   *string `json:"content"`
						Reasoning *string `json:"reasoning_content"`
						ToolCalls []struct {
							Index    int     `json:"index"`
							ID       *string `json:"id"`
							Type     *string `json:"type"`
							Function *struct {
								Name      *string `json:"name"`
								Arguments *string `json:"arguments"`
							} `json:"function"`
						} `json:"tool_calls"`
					} `json:"delta"`
					FinishReason *string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta

				if delta.Reasoning != nil && *delta.Reasoning != "" {
					ch <- StreamEvent{Type: "reasoning", Content: *delta.Reasoning}
				}
				if delta.Content != nil && *delta.Content != "" {
					ch <- StreamEvent{Type: "content", Content: *delta.Content}
				}

				for _, tc := range delta.ToolCalls {
					for len(currentToolCalls) <= tc.Index {
						currentToolCalls = append(currentToolCalls, schema.ToolCall{})
					}

					if tc.ID != nil {
						currentToolCalls[tc.Index].ID = *tc.ID
					}
					if tc.Type != nil {
						currentToolCalls[tc.Index].Type = *tc.Type
					}
					if tc.Function != nil {
						if tc.Function.Name != nil {
							currentToolCalls[tc.Index].Function.Name = *tc.Function.Name
						}
						if tc.Function.Arguments != nil {
							currentToolCalls[tc.Index].Function.Arguments += *tc.Function.Arguments
						}
					}
				}

				if chunk.Choices[0].FinishReason != nil && *chunk.Choices[0].FinishReason == "tool_calls" {
					// Finish reason is tool_calls, send accumulated
					ch <- StreamEvent{Type: "tool_calls", ToolCalls: currentToolCalls}
				}
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamEvent{Type: "error", Error: fmt.Errorf("stream reading error: %v", err)}
		}

		ch <- StreamEvent{Type: "done"}
	}()

	return ch, nil
}
