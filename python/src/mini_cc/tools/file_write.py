"""
文件写入工具 (file_write.py)
==========================

用于将内容写入本地文件的工具。
"""

import os
from .base import register_tool

@register_tool(
    name="file_write",
    description="将内容写入文件",
    input_schema={
        "file_path": {"type": "string"},
        "content": {"type": "string"},
        "append": {"type": "boolean", "default": False}
    }
)
def file_write(file_path: str, content: str, append: bool = False) -> str:
    """
    将内容写入指定文件。
    
    :param file_path: 文件路径（相对路径或绝对路径）
    :param content: 要写入的内容
    :param append: 是否追加模式（默认覆盖写入）
    :return: 操作结果消息
    """
    try:
        # 确保父目录存在
        parent_dir = os.path.dirname(file_path)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
        
        mode = 'a' if append else 'w'
        with open(file_path, mode, encoding='utf-8') as f:
            f.write(content)
        
        action = "追加" if append else "写入"
        return f"成功{action}文件 '{file_path}'，内容长度: {len(content)} 字符"
    except Exception as e:
        return f"写入文件时发生错误: {str(e)}"
