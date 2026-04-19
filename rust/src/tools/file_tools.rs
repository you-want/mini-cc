use super::{Tool, ToolExecuteFn};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

pub fn get_read_tool() -> Tool {
    Tool {
        name: "FileReadTool".to_string(),
        description: "读取本地系统上的文件内容。\n用于获取代码文件、配置文件或者日志。\n注意：\n- 请提供需要读取的文件的绝对路径，不要使用相对路径。\n- 如果遇到过大文件（如日志），该工具只会返回前 1000 行。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "需要读取文件的绝对路径"
                }
            },
            "required": ["file_path"]
        }),
        execute: execute_read as ToolExecuteFn,
    }
}

fn execute_read(args: Value) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send>> {
    Box::pin(async move {
        let file_path = match args.get("file_path").and_then(|v| v.as_str()) {
            Some(p) => p.to_string(),
            None => return Err("读取文件时出错：file_path 不能为空".to_string()),
        };

        match fs::read_to_string(&file_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                if lines.len() > 1000 {
                    let truncated = lines[0..1000].join("\n");
                    Ok(format!("{}\n\n... (文件已截断，仅显示前 1000 行)", truncated))
                } else {
                    Ok(content)
                }
            }
            Err(e) => Err(format!("读取文件时出错：{}", e)),
        }
    })
}

pub fn get_write_tool() -> Tool {
    Tool {
        name: "FileWriteTool".to_string(),
        description: "将内容写入到指定文件。\n注意：\n- 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。\n- 如果目录不存在，系统会自动为你递归创建所需的父目录。\n- 始终使用绝对路径。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "目标文件的绝对路径"
                },
                "content": {
                    "type": "string",
                    "description": "要写入的完整文件内容"
                }
            },
            "required": ["file_path", "content"]
        }),
        execute: execute_write as ToolExecuteFn,
    }
}

fn execute_write(args: Value) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send>> {
    Box::pin(async move {
        let file_path = match args.get("file_path").and_then(|v| v.as_str()) {
            Some(p) => p.to_string(),
            None => return Err("写入文件时出错：file_path 不能为空".to_string()),
        };

        let content = match args.get("content").and_then(|v| v.as_str()) {
            Some(c) => c.to_string(),
            None => return Err("写入文件时出错：content 不能为空".to_string()),
        };

        let path = Path::new(&file_path);
        if let Some(parent) = path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("创建目录时出错：{}", e));
            }
        }

        match fs::write(path, content) {
            Ok(_) => Ok(format!("文件写入成功：{}", file_path)),
            Err(e) => Err(format!("写入文件时出错：{}", e)),
        }
    })
}