import os
import aiofiles
from pathlib import Path
from pydantic import BaseModel, Field
from .base import BaseTool

class FileWriteArgs(BaseModel):
    file_path: str = Field(..., description="要写入的文件的绝对或相对路径。")
    content: str = Field(..., description="要写入的完整文件内容。")

class FileWriteTool(BaseTool):
    name = "FileWriteTool"
    description = "将文本内容完全覆盖写入到指定的本地文件中。大模型可以通过它来创建新文件、修改代码或更新配置。注意：这是覆盖写入，不是追加。"
    args_schema = FileWriteArgs
    
    async def execute(self, file_path: str, content: str) -> str:
        """
        使用 aiofiles 异步写入文件内容。
        在实际 Agent 开发中，这一步往往非常重要，它是 AI “编写代码” 的手脚。
        """
        # 获取当前工作目录，并强制重定向到 ../test_file (相对于 python/ 目录)
        workspace_dir = (Path.cwd() / ".." / "test_file").resolve()
        path = Path(file_path)
        
        # 如果大模型给出的是相对路径，我们把它拼接到当前工作目录下
        if not path.is_absolute():
            path = workspace_dir / path
        
        try:
            # 1. 安全检查与自动创建父目录
            # 在写文件前，如果目标文件夹不存在，我们得先帮它建好 (相当于 mkdir -p)
            # parents=True 表示连同不存在的父级目录一起创建
            # exist_ok=True 表示如果目录已经存在，就静默放行，不抛异常
            parent_dir = path.parent
            if not parent_dir.exists():
                parent_dir.mkdir(parents=True, exist_ok=True)
                
            # 2. 检查是不是一个目录
            if path.exists() and path.is_dir():
                return f"错误：'{file_path}' 是一个目录，不能当做文件来写入。请检查路径。"
                
            # 3. 异步覆盖写入
            # mode="w" 意味着覆盖写入（如果文件已存在，里面的内容会被全部清空替换为新的）
            async with aiofiles.open(path, mode="w", encoding="utf-8") as f:
                await f.write(content)
                
            # 4. 返回友好的成功信息，告诉大模型任务完成了
            return f"成功！内容已成功覆盖写入到 '{file_path}' 中。文件大小：{len(content)} 字符。"
            
        except PermissionError:
            # 在 Linux/Mac 上常见的问题：想改的文件没有写权限
            return f"错误：没有权限写入文件 '{file_path}'。如果是系统文件，大模型可能需要先请求用户执行 sudo 操作。"
        except Exception as e:
            return f"写入文件时发生系统错误: {str(e)}"
