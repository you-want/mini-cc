package tools

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileWriteTool_Execute(t *testing.T) {
	tool := NewFileWriteTool()
	tmpDir := t.TempDir()
	ctx := &ToolContext{
		Ctx:          context.Background(),
		WorkspaceDir: tmpDir,
	}

	testFile := "test_write.txt"
	testContent := "Hello, Go Agent!"

	// Test 1: Normal write
	args := map[string]interface{}{
		"file_path": testFile,
		"content":   testContent,
	}
	_, err := tool.Execute(args, ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify file
	content, _ := os.ReadFile(filepath.Join(tmpDir, testFile))
	if string(content) != testContent {
		t.Errorf("Expected %s, got %s", testContent, string(content))
	}

	// Test 2: require_new = true on existing file
	argsRequireNew := map[string]interface{}{
		"file_path":   testFile,
		"content":     "New Content",
		"require_new": true,
	}
	out, err := tool.Execute(argsRequireNew, ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if !strings.Contains(out, "写入失败") && !strings.Contains(out, "已经存在") {
		t.Errorf("Expected overwrite protection message, got: %s", out)
	}
}