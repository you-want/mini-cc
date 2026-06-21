"""
Bash 命令执行工具 (bash.py)
==========================

用于执行 shell 命令的工具，集成了安全检查机制。
"""

import subprocess
from pydantic import BaseModel, Field
from .base import BaseTool
from .security.destructive_warning import is_destructive_command
from .security.bash_security import check_bash_security


class BashArgs(BaseModel):
    """Bash 工具的参数定义"""
    command: str = Field(..., description="要执行的 shell 命令")


class BashTool(BaseTool):
    """
    命令执行工具。
    
    执行指定的 shell 命令，内置安全检查防止执行危险操作。
    超时限制为 30 秒。
    """
    name = "Bash"
    description = "执行 shell 命令。可用于运行各种终端命令，如 ls、cat、git、npm、python 等。命令超时限制为 30 秒。"
    args_schema = BashArgs
    
    async def execute(self, command: str) -> str:
        """
        执行命令。
        
        :param command: 要执行的 shell 命令
        :return: 命令执行结果（stdout + stderr）
        """
        # 安全检查 1：破坏性命令拦截
        if is_destructive_command(command):
            return f"安全拦截：检测到高危破坏性命令，已拒绝执行。\n命令: {command}\n\n如果确实需要执行，请手动在终端中运行。"
        
        # 安全检查 2：子命令注入拦截
        if check_bash_security(command):
            return f"安全拦截：检测到可疑的命令替换模式，已拒绝执行。\n命令: {command}\n\n这是为了防止通过 $(...) 或反引号绕过安全检查。"
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            output = ""
            if result.stdout:
                output += f"标准输出:\n{result.stdout}\n"
            if result.stderr:
                output += f"错误输出:\n{result.stderr}\n"
            
            if result.returncode == 0:
                output += f"执行成功，退出码: {result.returncode}"
            else:
                output += f"退出码: {result.returncode}"
            
            return output
        except subprocess.TimeoutExpired:
            return f"错误：命令执行超时（超过 30 秒）\n命令: {command}"
        except Exception as e:
            return f"执行命令时发生错误: {str(e)}"
