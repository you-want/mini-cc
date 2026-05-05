package tools

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/you-want/mini-cc/go/pkg/schema"
)

type FileWriteTool struct{}

func NewFileWriteTool() *FileWriteTool {
	return &FileWriteTool{}
}

func (t *FileWriteTool) Name() string {
	return "file_write"
}

func (t *FileWriteTool) Schema() schema.ToolFunctionSchema {
	return schema.ToolFunctionSchema{
		Name:        t.Name(),
		Description: "Write content to a file. Overwrites if file exists, creates new if it doesn't.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"file_path": map[string]interface{}{
					"type":        "string",
					"description": "Absolute or relative path to the file to write.",
				},
				"content": map[string]interface{}{
					"type":        "string",
					"description": "The content to write to the file.",
				},
				"require_new": map[string]interface{}{
					"type":        "boolean",
					"description": "If true, the operation will fail if the file already exists. Use this when you intend to create a NEW file and want to avoid accidentally overwriting an existing one.",
				},
			},
			"required": []string{"file_path", "content"},
		},
	}
}

func (t *FileWriteTool) Execute(args map[string]interface{}, ctx *ToolContext) (string, error) {
	filePath, ok := args["file_path"].(string)
	if !ok {
		return "", fmt.Errorf("参数 'file_path' 缺失或无效")
	}
	content, ok := args["content"].(string)
	if !ok {
		return "", fmt.Errorf("参数 'content' 缺失或无效")
	}

	requireNew := false
	if rn, ok := args["require_new"].(bool); ok {
		requireNew = rn
	}

	// 将相对路径解析为基于沙盒工作区的绝对路径
	fullPath := filePath
	if !filepath.IsAbs(filePath) {
		fullPath = filepath.Join(ctx.WorkspaceDir, filePath)
	}

	// 安全机制：防覆盖检查
	// 当大模型试图“新建”文件时，如果发现同名文件已存在，直接拦截报错，并引导其换个名字
	if requireNew {
		if _, err := os.Stat(fullPath); err == nil {
			return fmt.Sprintf("写入失败：文件 %s 已经存在！为了保护你的旧代码不被意外覆盖，本次写入已被拒绝。如果你是想修改它，请将 require_new 设为 false。如果你想创建一个新文件，请更换一个不同的文件名。", filePath), nil
		}
	}

	// 确保目标文件的父级目录存在，不存在则自动创建
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("创建目录失败: %v", err)
	}

	// 写入文件内容
	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("写入文件失败: %v", err)
	}

	return fmt.Sprintf("成功将内容写入到 %s", filePath), nil
}
