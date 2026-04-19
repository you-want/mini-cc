package tools

import (
	"os"
	"strings"
	"testing"
)

func TestBashTool_SafeCommand(t *testing.T) {
	args := map[string]interface{}{
		"command": "echo 'hello world'",
	}
	res, err := BashTool.Execute(args)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !strings.Contains(res, "hello world") {
		t.Errorf("expected output to contain 'hello world', got %s", res)
	}
}

func TestBashTool_DangerousCommand(t *testing.T) {
	dangerousCommands := []string{
		"rm -rf /",
		"rm -rF /",
		"mkfs.ext4 /dev/sda1",
		"dd if=/dev/zero of=/dev/sda",
		"echo hello > /dev/sda",
		"echo $(ls)",
		"echo `ls`",
	}

	for _, cmd := range dangerousCommands {
		args := map[string]interface{}{"command": cmd}
		res, err := BashTool.Execute(args)
		if err != nil {
			t.Fatalf("expected no error from Execute, got %v", err)
		}
		if !strings.Contains(res, "安全沙盒拦截") {
			t.Errorf("expected command '%s' to be blocked by sandbox, but got: %s", cmd, res)
		}
	}
}

func TestBashTool_InvalidArgs(t *testing.T) {
	// Missing command
	res, _ := BashTool.Execute(map[string]interface{}{})
	if !strings.Contains(res, "command 不能为空") {
		t.Errorf("expected missing command error, got: %s", res)
	}

	// Wrong type
	res, _ = BashTool.Execute(map[string]interface{}{"command": 123})
	if !strings.Contains(res, "必须是字符串") {
		t.Errorf("expected type error, got: %s", res)
	}
}

func TestFileWriteAndReadTool(t *testing.T) {
	tmpFile := "./tmp_test_dir/test_file.txt"
	defer os.RemoveAll("./tmp_test_dir") // cleanup

	// Test Write
	writeArgs := map[string]interface{}{
		"file_path": tmpFile,
		"content":   "line 1\nline 2\nline 3",
	}
	writeRes, _ := FileWriteTool.Execute(writeArgs)
	if !strings.Contains(writeRes, "文件写入成功") {
		t.Fatalf("expected write success, got: %s", writeRes)
	}

	// Test Read
	readArgs := map[string]interface{}{
		"file_path": tmpFile,
	}
	readRes, _ := FileReadTool.Execute(readArgs)
	if !strings.Contains(readRes, "line 2") {
		t.Errorf("expected read output to contain 'line 2', got: %s", readRes)
	}
}

func TestFileReadTool_Truncate(t *testing.T) {
	tmpFile := "./tmp_test_truncate.txt"
	defer os.Remove(tmpFile)

	// Create a file with 1005 lines
	var sb strings.Builder
	for i := 0; i < 1005; i++ {
		sb.WriteString("line\n")
	}
	os.WriteFile(tmpFile, []byte(sb.String()), 0644)

	readArgs := map[string]interface{}{
		"file_path": tmpFile,
	}
	readRes, _ := FileReadTool.Execute(readArgs)
	if !strings.Contains(readRes, "文件已截断") {
		t.Errorf("expected file to be truncated, got output length: %d", len(readRes))
	}
}
