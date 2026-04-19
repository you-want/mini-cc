"""
Bash 命令执行工具 (bash_tool.py)
==============================
为 Agent 提供在宿主机执行终端命令的能力。
包含了基于正则表达式的简易安全沙盒，用于拦截明显的高危破坏性命令。
"""

import subprocess
import os
import re

# 危险命令模式匹配列表，防止 Agent 执行破坏性操作
DANGEROUS_PATTERNS = [
    re.compile(r'rm\s+-r[fF]?\s+/'),         # 禁止删除根目录
    re.compile(r'mkfs\.'),                   # 禁止格式化文件系统
    re.compile(r'dd\s+if=.*of=/dev/sda'),    # 禁止覆写磁盘
    re.compile(r'>\s*/dev/sd[a-z]'),         # 禁止直接写入块设备
]

# 命令替换语法模式匹配列表，防止通过反引号或 $() 绕过安全检查
COMMAND_SUBSTITUTION_PATTERNS = [
    re.compile(r'\$\([^)]+\)'),  # $(...)
    re.compile(r'`[^`]+`'),      # `...`
]

def check_command_security(command: str):
    """
    检查命令是否安全，包含多重防护机制
    """
    # 1. 检查明显的高危破坏性命令
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(command):
            return {"isSafe": False, "reason": f"包含高危指令模式 ({pattern.pattern})"}
            
    # 2. 拦截可能隐藏恶意的命令替换语法
    for pattern in COMMAND_SUBSTITUTION_PATTERNS:
        if pattern.search(command):
            return {"isSafe": False, "reason": f"禁止使用命令替换语法以防越权注入 ({pattern.pattern})"}
            
    return {"isSafe": True}

async def execute_bash(args: dict) -> str:
    """
    异步执行 bash 命令
    """
    command = args.get("command")
    if not command:
        return "执行命令时出错: command 不能为空"
    
    # 执行前进行安全审查
    security_check = check_command_security(command)
    if not security_check["isSafe"]:
        # 记录拦截日志并返回给模型
        print(f"\n[BashTool 安全拦截] 拒绝执行高危命令: {command}")
        return f"命令执行被安全沙盒拒绝：{security_check['reason']}\n请修改你的方案或采取其他不具备破坏性的方式。"
    
    print(f"[BashTool] 正在执行命令: {command}")
    
    try:
        import asyncio
        # 使用 asyncio.create_subprocess_shell 异步执行 shell 命令
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.getcwd()  # 在当前工作目录下执行
        )
        stdout, stderr = await process.communicate()
        out = stdout.decode('utf-8')
        err = stderr.decode('utf-8')
        
        # 如果有标准错误输出，将其与标准输出合并返回
        if err:
            return f"[stdout]\n{out}\n[stderr]\n{err}"
        return out or "命令执行成功，但没有输出。"
    except Exception as e:
        return f"执行命令时出错:\n{str(e)}"

bash_tool = {
    "name": "BashTool",
    "description": """
    在本地系统执行 Bash/Shell 命令。
    使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。
    注意：
    - 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。
    - 始终使用绝对路径或基于当前工作目录的相对路径。
    - 如果命令可能会产生大量输出，请使用 `head` 或 `grep` 进行截断和过滤。
    - 如果你仅仅是为了在写入文件前创建目录（如 mkdir -p），请不要使用此工具！FileWriteTool 在写入时会自动为你创建所需的目录层级。
    """,
    "inputSchema": {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "需要执行的 shell 命令，例如：npm run build",
            },
        },
        "required": ["command"],
    },
    "execute": execute_bash
}