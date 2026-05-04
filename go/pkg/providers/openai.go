package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"minicc/pkg/schema"
)

type OpenAIProvider struct {
	BaseURL string
	APIKey  string
	Model   string
}

func NewOpenAIProvider(baseURL, apiKey, model string) *OpenAIProvider {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &OpenAIProvider{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Model:   model,
	}
}

func (p *OpenAIProvider) GenerateStream(ctx context.Context, messages []schema.Message, tools []schema.ToolSchema) (<-chan StreamEvent, error) {
	ch := make(chan StreamEvent)

	reqBody := map[string]interface{}{
		"model":    p.Model,
		"messages": messages,
		"stream":   true,
	}

	if len(tools) > 0 {
		reqBody["tools"] = tools
	}

	// Qwen specific
	if strings.Contains(strings.ToLower(p.Model), "qwen") {
		reqBody["stream_options"] = map[string]interface{}{
			"include_usage": true,
		}
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.APIKey)

	client := &http.Client{}
	go func() {
		defer close(ch)

		resp, err := client.Do(req)
		if err != nil {
			ch <- StreamEvent{Type: "error", Error: fmt.Errorf("request failed: %v", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// Read error body
			var errBody bytes.Buffer
			_, _ = errBody.ReadFrom(resp.Body)
			ch <- StreamEvent{Type: "error", Error: fmt.Errorf("API error (status %d): %s", resp.StatusCode, errBody.String())}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		
		var currentToolCalls []schema.ToolCall
		
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
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
