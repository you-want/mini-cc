package tools

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/you-want/mini-cc/go/pkg/schema"
)

type FileReadTool struct{}

func NewFileReadTool() *FileReadTool {
	return &FileReadTool{}
}

func (t *FileReadTool) Name() string {
	return "file_read"
}

func (t *FileReadTool) Schema() schema.ToolFunctionSchema {
	return schema.ToolFunctionSchema{
		Name:        t.Name(),
		Description: "Read the contents of a file.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"file_path": map[string]interface{}{
					"type":        "string",
					"description": "Absolute or relative path to the file to read.",
				},
				"offset": map[string]interface{}{
					"type":        "integer",
					"description": "The line number to start reading from (1-indexed). Optional.",
				},
				"limit": map[string]interface{}{
					"type":        "integer",
					"description": "The maximum number of lines to read. Optional.",
				},
			},
			"required": []string{"file_path"},
		},
	}
}

func (t *FileReadTool) Execute(args map[string]interface{}, ctx *ToolContext) (string, error) {
	filePath, ok := args["file_path"].(string)
	if !ok {
		return "", fmt.Errorf("参数 'file_path' 缺失或无效")
	}

	offset := 1
	if o, ok := args["offset"].(float64); ok {
		offset = int(o)
	}

	limit := -1
	if l, ok := args["limit"].(float64); ok {
		limit = int(l)
	}

	// 将相对路径解析为基于沙盒工作区的绝对路径
	fullPath := filePath
	if !filepath.IsAbs(filePath) {
		fullPath = filepath.Join(ctx.WorkspaceDir, filePath)
	}

	file, err := os.Open(fullPath)
	if err != nil {
		return fmt.Sprintf("打开文件失败: %v", err), nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var lines []string
	currentLine := 1

	// 逐行读取文件内容，并附加上行号返回（方便大模型后续精准修改某一行）
	for scanner.Scan() {
		if currentLine >= offset {
			lines = append(lines, fmt.Sprintf("%d | %s", currentLine, scanner.Text()))
			if limit > 0 && len(lines) >= limit {
				break
			}
		}
		currentLine++
	}

	if err := scanner.Err(); err != nil {
		return fmt.Sprintf("读取文件发生错误: %v", err), nil
	}

	if len(lines) == 0 {
		return "该文件为空，或者指定的 offset 已经超出了文件末尾。", nil
	}

	return strings.Join(lines, "\n"), nil
}
