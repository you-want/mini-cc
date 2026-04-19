package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// FileReadTool 用于赋予大模型读取本地文件内容的能力
var FileReadTool = Tool{
	Name: "FileReadTool",
	Description: `读取本地系统上的文件内容。
用于获取代码文件、配置文件或者日志。
注意：
- 请提供需要读取的文件的绝对路径，不要使用相对路径。
- 如果遇到过大文件（如日志），该工具只会返回前 1000 行。`,
	InputSchema: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"file_path": map[string]interface{}{
				"type":        "string",
				"description": "需要读取文件的绝对路径",
			},
		},
		"required": []string{"file_path"},
	},
	Execute: func(args map[string]interface{}) (string, error) {
		// 提取并校验 file_path 参数
		filePathRaw, ok := args["file_path"]
		if !ok {
			return "读取文件时出错：file_path 不能为空", nil
		}
		filePath, ok := filePathRaw.(string)
		if !ok {
			return "读取文件时出错：file_path 必须是字符串", nil
		}

		// 尝试读取文件内容
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Sprintf("读取文件时出错：%v", err), nil
		}

		// 为了防止文件过大导致上下文爆炸，强制按行分割并截断
		lines := strings.Split(string(content), "\n")
		if len(lines) > 1000 {
			// 如果超过 1000 行，截断并加上提示后缀
			return strings.Join(lines[:1000], "\n") + "\n\n... (文件已截断，仅显示前 1000 行)", nil
		}

		return string(content), nil
	},
}

// FileWriteTool 用于赋予大模型在本地系统写入或覆写文件内容的能力
var FileWriteTool = Tool{
	Name: "FileWriteTool",
	Description: `将内容写入到指定文件。
注意：
- 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。
- 如果目录不存在，系统会自动为你递归创建所需的父目录。
- 始终使用绝对路径。`,
	InputSchema: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"file_path": map[string]interface{}{
				"type":        "string",
				"description": "目标文件的绝对路径",
			},
			"content": map[string]interface{}{
				"type":        "string",
				"description": "要写入的完整文件内容",
			},
		},
		"required": []string{"file_path", "content"},
	},
	Execute: func(args map[string]interface{}) (string, error) {
		// 提取并校验参数
		filePathRaw, ok1 := args["file_path"]
		contentRaw, ok2 := args["content"]
		if !ok1 || !ok2 {
			return "写入文件时出错：file_path 或 content 不能为空", nil
		}

		filePath, ok1 := filePathRaw.(string)
		content, ok2 := contentRaw.(string)
		if !ok1 || !ok2 {
			return "写入文件时出错：file_path 和 content 必须是字符串", nil
		}

		// 获取文件的所在目录
		dir := filepath.Dir(filePath)
		if dir != "" {
			// 如果目录不存在，自动递归创建，权限 0755
			os.MkdirAll(dir, 0755)
		}

		// 写入文件，权限 0644。如果文件存在则会被完全覆盖
		err := os.WriteFile(filePath, []byte(content), 0644)
		if err != nil {
			return fmt.Sprintf("写入文件时出错：%v", err), nil
		}

		return fmt.Sprintf("文件写入成功：%s", filePath), nil
	},
}

// Tools 导出一个全局工具切片，方便被 Agent 一次性注册
var Tools = []Tool{
	BashTool,
	FileReadTool,
	FileWriteTool,
}
