use super::{Tool, ToolExecuteFn};
use serde_json::{json, Value};
use std::process::Command;

fn check_security(command: &str) -> Result<(), String> {
    let forbidden = ["rm -rf /", "mkfs", "dd if="];
    for f in forbidden {
        if command.contains(f) {
            return Err(format!("包含高危操作: {}", f));
        }
    }
    Ok(())
}

pub fn get_tool() -> Tool {
    Tool {
        name: "BashTool".to_string(),
        description: "在本地系统执行 Bash/Shell 命令。\n使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。\n注意：\n- 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。\n- 始终使用绝对路径或基于当前工作目录的相对路径。\n- 如果命令可能会产生大量输出，请使用 head 或 grep 进行截断和过滤。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "需要执行的 shell 命令"
                }
            },
            "required": ["command"]
        }),
        execute: execute as ToolExecuteFn,
    }
}

fn execute(args: Value) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send>> {
    Box::pin(async move {
        let cmd = match args.get("command").and_then(|v| v.as_str()) {
            Some(c) => c.to_string(),
            None => return Err("执行命令时出错: command 不能为空".to_string()),
        };

        if let Err(reason) = check_security(&cmd) {
            return Ok(format!("命令执行被安全沙盒拒绝：{}", reason));
        }

        let output = match Command::new("bash").arg("-c").arg(&cmd).output() {
            Ok(o) => o,
            Err(e) => return Err(format!("执行命令失败: {}", e)),
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !stderr.is_empty() && !output.status.success() {
            return Ok(format!("[错误]\n{}\n[输出]\n{}", stderr, stdout));
        }

        if stdout.is_empty() && stderr.is_empty() {
            return Ok("命令执行成功，但没有输出。".to_string());
        }

        Ok(format!("{}{}", stdout, stderr))
    })
}