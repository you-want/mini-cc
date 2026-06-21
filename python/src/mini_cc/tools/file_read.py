"""
文件读取工具 (file_read.py)
==========================

用于读取本地文件内容的工具。
支持 BaseTool 类模式（推荐）和旧版装饰器模式。
"""

from pydantic import BaseModel, Field
from typing import Optional
from .base import BaseTool


class FileReadArgs(BaseModel):
    """文件读取工具的参数定义"""
    file_path: str = Field(..., description="要读取的文件路径（相对路径或绝对路径）")
    limit: Optional[int] = Field(None, description="限制读取的行数（默认读取全部）。当文件很大时，建议设置此参数以避免输出过长。")


class FileReadTool(BaseTool):
    """
    文件读取工具。
    
    读取指定文件的内容并返回。支持文本文件，自动检测编码。
    支持 limit 参数限制读取行数，适合处理大型文件。
    """
    name = "FileRead"
    description = "读取指定文件的完整内容。支持文本文件，自动检测编码。如果文件不存在会返回错误信息。可通过 limit 参数限制读取行数。"
    args_schema = FileReadArgs
    
    async def execute(self, file_path: str, limit: Optional[int] = None) -> str:
        """
        读取文件内容。
        
        :param file_path: 文件路径（相对路径或绝对路径）
        :param limit: 限制读取的行数（None 表示读取全部）
        :return: 文件内容字符串
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            return f"错误：文件 '{file_path}' 不存在，请检查路径是否正确。"
        except PermissionError:
            return f"错误：没有权限读取文件 '{file_path}'。"
        except UnicodeDecodeError:
            # 尝试用 latin-1 编码读取（能读取任意字节）
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    content = f.read()
            except Exception as e:
                return f"读取文件时发生错误: {str(e)}"
        except Exception as e:
            return f"读取文件时发生错误: {str(e)}"
        
        # 如果有 limit 参数，按行截断
        if limit is not None and limit > 0:
            lines = content.split('\n')
            total_lines = len(lines)
            if total_lines > limit:
                truncated_content = '\n'.join(lines[:limit])
                return (
                    f"成功读取文件 '{file_path}'，共 {total_lines} 行，"
                    f"显示第 1 到 {limit} 行（内容已截断）：\n\n{truncated_content}"
                )
            else:
                return (
                    f"成功读取文件 '{file_path}'，共 {len(content)} 个字符，"
                    f"内容如下：\n\n{content}"
                )
        
        return f"成功读取文件 '{file_path}'，共 {len(content)} 个字符，内容如下：\n\n{content}"
