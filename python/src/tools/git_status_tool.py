import os
import asyncio
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseTool

class GitStatusArgs(BaseModel):
    directory: Optional[str] = Field(None, description="要检查的目录路径。如果不提供，默认使用当前工作路径。")

class GitStatusTool(BaseTool):
    name = "GitStatus"
    description = "获取当前代码库的 git 状态。这是一个只读工具，大模型可以通过它快速了解当前分支是否干净、有哪些未提交的修改。"
    args_schema = GitStatusArgs
    
    async def execute(self, directory: Optional[str] = None) -> str:
        """
        极简版 Git 状态工具 (实现 BaseTool 接口)
        帮助大模型快速获取当前代码库的 git 状态。
        这是一个绝对安全的只读操作示例。
        """
        # 获取当前工作目录，并强制重定向到 ../test_file (为了沙盒安全测试)
        workspace_dir = (Path.cwd() / ".." / "test_file").resolve()
        
        target_dir = workspace_dir
        if directory:
            target_path = Path(directory)
            if target_path.is_absolute():
                target_dir = target_path
            else:
                target_dir = workspace_dir / target_path
                
        try:
            print(f"\n[GitStatusTool] 正在获取 Git 状态 (目录: {target_dir})...")
            
            # 使用 asyncio.create_subprocess_shell 异步执行 shell 命令
            process = await asyncio.create_subprocess_shell(
                "git status --short",
                cwd=str(target_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                err_msg = stderr.decode().strip()
                return f"执行 Git 状态查询失败: {err_msg}"
                
            result = stdout.decode().strip()
            return result if result else "当前分支很干净，没有任何未提交的修改。"
            
        except Exception as e:
            return f"执行 Git 状态查询时发生异常: {str(e)}"

# 导出一个单例供外部注册使用
git_status_tool = GitStatusTool()
