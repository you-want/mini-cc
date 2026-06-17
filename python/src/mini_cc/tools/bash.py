"""
Bash 命令执行工具 (bash.py)
==========================

用于执行 shell 命令的工具。
"""

import subprocess
from .base import register_tool

@register_tool(
    name="bash",
    description="执行 shell 命令",
    input_schema={"command": {"type": "string"}}
)
def run_bash(command: str) -> str:
    """
    执行指定的 shell 命令。
    
    :param command: 要执行的命令
    :return: 命令执行结果（stdout + stderr）
    """
    try:
        # 使用 subprocess 执行命令
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30  # 设置超时时间，防止命令挂起
        )
        
        output = ""
        if result.stdout:
            output += f"标准输出:\n{result.stdout}\n"
        if result.stderr:
            output += f"错误输出:\n{result.stderr}\n"
        output += f"退出码: {result.returncode}"
        
        return output
    except subprocess.TimeoutExpired:
        return f"错误：命令执行超时（超过 30 秒）"
    except Exception as e:
        return f"执行命令时发生错误: {str(e)}"
