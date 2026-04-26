import os
import aiofiles
from pathlib import Path
from pydantic import BaseModel, Field
from .base import BaseTool

class FileReadArgs(BaseModel):
    # 使用 Pydantic 的 Field 来详细描述参数，大模型就是看这些描述来决定怎么传参的
    file_path: str = Field(..., description="要读取的文件的绝对或相对路径。")
    # 可选参数，用于读取大文件时限制行数，防止把上下文撑爆
    limit: int = Field(default=2000, description="最多读取的行数，默认 2000。")
    offset: int = Field(default=0, description="从哪一行开始读取（从 0 开始），默认 0。")

class FileReadTool(BaseTool):
    name = "FileReadTool"
    description = "读取本地文件的内容。大模型可以通过它来查看源代码、配置或日志文件。"
    args_schema = FileReadArgs
    
    async def execute(self, file_path: str, limit: int = 2000, offset: int = 0) -> str:
        """
        使用 aiofiles 异步读取文件内容。
        这在 Python 中是处理文件 I/O 不阻塞主线程的最佳实践。
        """
        path = Path(file_path)
        
        # 1. 安全检查：文件是否存在
        if not path.exists():
            return f"错误：找不到文件 '{file_path}'"
            
        if not path.is_file():
            return f"错误：'{file_path}' 不是一个普通文件（可能是目录）。请使用 BashTool 运行 ls 来查看。"
            
        try:
            # 2. 使用 aiofiles 异步打开文件 (类似于 TS 中的 fs.promises.readFile)
            # mode="r" 表示读取，encoding="utf-8" 是标准编码
            async with aiofiles.open(path, mode="r", encoding="utf-8") as f:
                # 简单粗暴的读取所有行，然后进行切片
                # 注意：对于几个 GB 的超大文件，readlines 会把内容都塞进内存，
                # 但对于普通代码文件，这种写法最简单直观。
                lines = await f.readlines()
                
                # 处理 offset 和 limit
                start = max(0, offset)
                end = start + limit
                
                # 提取目标行
                target_lines = lines[start:end]
                
                # 把列表重新拼成字符串
                content = "".join(target_lines)
                
                # 构造友好的返回信息
                total_lines = len(lines)
                info = f"成功读取 '{file_path}' (共 {total_lines} 行)。\n"
                if start > 0 or end < total_lines:
                    info += f"当前显示第 {start + 1} 到 {min(end, total_lines)} 行：\n"
                else:
                    info += "文件完整内容如下：\n"
                    
                info += "-" * 40 + "\n"
                info += content
                info += "\n" + "-" * 40
                
                return info
                
        except UnicodeDecodeError:
            return f"错误：无法以 UTF-8 编码读取文件 '{file_path}'。这可能是一个二进制文件（如图片、编译产物），大模型无法直接阅读。"
        except Exception as e:
            return f"读取文件时发生系统错误: {str(e)}"
