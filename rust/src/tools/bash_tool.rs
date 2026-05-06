use super::{Tool, ToolExecuteFn};
use serde_json::{json, Value};
use std::process::Command;
use regex::Regex;

/// 剥离外层包装命令（如 sudo、timeout、watch），提取核心命令用于安全检查
fn strip_command_wrappers(cmd: &str) -> String {
    let wrapper_regex = Regex::new(r"^(?:sudo\s+|timeout\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d+[smhd]?\s+|watch\s+(?:-[a-zA-Z]+\s+(?:\d+\s+)?)*\d*\.?\d*\s+)+").unwrap();
    let watch_regex = Regex::new(r"^watch\s+").unwrap();

    let mut current = cmd.trim().to_string();
    loop {
        let mut new_cmd = wrapper_regex.replace_all(&current, "").to_string();
        new_cmd = watch_regex.replace_all(new_cmd.trim(), "").to_string();
        new_cmd = new_cmd.trim().to_string();
        
        if new_cmd == current {
            break;
        }
        current = new_cmd;
    }
    current
}

fn check_security(command: &str) -> Result<(), String> {
    let base_cmd = strip_command_wrappers(command);

    // 先做一层针对 rm 参数顺序变体的精确拦截（例如 rm -f -r /、rm -r -f /）
    // 这类命令不一定匹配固定的 "-rf" 字样，但本质同样危险。
    let rm_variants = Regex::new(r"^rm\s+((?:-[a-zA-Z]+\s+)+)(/|\*)\s*$").unwrap();
    for candidate in [command.trim(), base_cmd.trim()] {
        if let Some(caps) = rm_variants.captures(candidate) {
            let flags = caps.get(1).map(|m| m.as_str()).unwrap_or("").to_lowercase();
            if flags.contains('r') && flags.contains('f') {
                return Err("【严重警告：您的命令被系统强行终止！】\n您尝试执行的命令包含高危操作。安全沙盒已拦截此操作。".to_string());
            }
        }
    }

    let destructive_patterns = [
        r"rm\s+-rf\s+/\s*$",
        r"rm\s+-rf\s+\*\s*$",
        r"rm\s+-rf\s+/\*\s*$",
        r"mkfs(?:\.[a-z0-9]+)?\s+/[a-zA-Z0-9/]+",
        r"dd\s+if=/dev/(?:zero|urandom)\s+of=/[a-zA-Z0-9/]+",
        r">\s*/dev/sda",
        r":\(\)\{\s*:\|:&\s*\};:",
        r">\s*/etc/[a-zA-Z0-9_.-]+",
    ];

    for pattern in &destructive_patterns {
        let re = Regex::new(pattern).unwrap();
        if re.is_match(&base_cmd) || re.is_match(command) {
            return Err("【严重警告：您的命令被系统强行终止！】\n您尝试执行的命令包含高危操作。安全沙盒已拦截此操作。".to_string());
        }
    }

    let cmd_sub_pattern = Regex::new(r"\$\(.*\)|\`.*\`").unwrap();
    if cmd_sub_pattern.is_match(&base_cmd) || cmd_sub_pattern.is_match(command) {
        return Err("【严重警告】命令替换语法被拦截。".to_string());
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

        // 动态获取工作目录：优先使用约定的 test_file，若不存在则回退到当前目录
        let current_dir = std::env::current_dir().unwrap_or_default();
        let preferred_workspace_dir = current_dir.parent().unwrap_or(&current_dir).join("test_file");
        let workspace_dir = if preferred_workspace_dir.is_dir() {
            preferred_workspace_dir
        } else {
            current_dir
        };

        if let Err(reason) = check_security(&cmd) {
            // 注意：安全拦截错误作为普通的文本输出返回给大模型，让它知道自己被拦截了
            return Ok(format!("安全沙盒已拦截：{}", reason));
        }

        let output = match Command::new("bash").arg("-c").arg(&cmd).current_dir(&workspace_dir).output() {
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
