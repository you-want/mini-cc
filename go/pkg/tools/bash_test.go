package tools

import (
	"context"
	"strings"
	"testing"
)

func TestBashTool_Execute(t *testing.T) {
	tool := NewBashTool()
	ctx := &ToolContext{
		Ctx:          context.Background(),
		WorkspaceDir: ".",
	}

	// Test 1: Safe command
	args := map[string]interface{}{
		"command": "echo 'hello test'",
	}
	out, err := tool.Execute(args, ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if !strings.Contains(out, "hello test") {
		t.Errorf("Expected output to contain 'hello test', got: %s", out)
	}

	// Test 2: Dangerous command (should be blocked by sandbox)
	argsDangerous := map[string]interface{}{
		"command": "rm -rf /",
	}
	outDangerous, err := tool.Execute(argsDangerous, ctx)
	if err != nil {
		t.Fatalf("Expected sandbox error to be returned as string, not error, got: %v", err)
	}
	if !strings.Contains(outDangerous, "安全沙盒已拦截") {
		t.Errorf("Expected security violation message, got: %s", outDangerous)
	}
}
