"""
文件读取工具 (file_read.py)
==========================

用于读取本地文件内容的工具。
"""

from .base import register_tool

@register_tool(
    name="file_read",
    description="读取文件内容",
    input_schema={"file_path": {"type": "string"}}
)
def file_read(file_path: str) -> str:
    """
    读取指定文件的内容。
    
    :param file_path: 文件路径（相对路径或绝对路径）
    :return: 文件内容字符串
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            return f"成功读取文件 '{file_path}'，内容如下：\n\n{content}"
    except FileNotFoundError:
        return f"错误：文件 '{file_path}' 不存在"
    except Exception as e:
        return f"读取文件时发生错误: {str(e)}"
