package core

import (
	"strings"
	"testing"
)

// MockProvider is a dummy implementation of LLMProvider for testing
type MockProvider struct {
	LoopCount int
}

func (m *MockProvider) SendMessage(userMessage string, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	m.LoopCount++
	// Mock returning a tool call
	return map[string]interface{}{
		"text": "Sure, let me check the system.",
		"toolCalls": []map[string]interface{}{
			{
				"id":   "call_123",
				"name": "BashTool",
				"args": map[string]interface{}{
					"command": "echo 'from mock'",
				},
			},
		},
	}, nil
}

func (m *MockProvider) SendToolResults(results []map[string]interface{}, onTextResponse func(text string, isThinking bool)) (map[string]interface{}, error) {
	m.LoopCount++
	// If it's the second call, just return text to end the loop
	return map[string]interface{}{
		"text": "Done.",
		// no tool calls, should break the loop
	}, nil
}

func TestAgent_ChatLoop(t *testing.T) {
	mockProvider := &MockProvider{}
	agent := NewAgent(mockProvider)

	agent.Chat("Hello", func(text string, isThinking bool) {})

	if mockProvider.LoopCount != 2 {
		t.Errorf("expected provider to be called 2 times (1 msg + 1 tool result), got %d", mockProvider.LoopCount)
	}
}

func TestAgent_HandleToolCalls_ParseError(t *testing.T) {
	agent := NewAgent(&MockProvider{})
	
	// Mock a parse error from provider
	toolCalls := []map[string]interface{}{
		{
			"id":   "call_err",
			"name": "BashTool",
			"args": map[string]interface{}{
				"_parse_error":   true,
				"_raw_arguments": "{ bad json }",
			},
		},
	}
	
	results := agent.handleToolCalls(toolCalls)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	
	resText := results[0]["result"].(string)
	if !strings.Contains(resText, "[Agent 内部错误]") {
		t.Errorf("expected parse error message, got: %s", resText)
	}
}

func TestAgent_HandleToolCalls_UnknownTool(t *testing.T) {
	agent := NewAgent(&MockProvider{})
	
	toolCalls := []map[string]interface{}{
		{
			"id":   "call_unk",
			"name": "UnknownToolThatDoesNotExist",
			"args": map[string]interface{}{},
		},
	}
	
	results := agent.handleToolCalls(toolCalls)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	
	resText := results[0]["result"].(string)
	if !strings.Contains(resText, "未知的工具调用") {
		t.Errorf("expected unknown tool error message, got: %s", resText)
	}
}
