"""
文件写入工具 (file_write.py)
==========================

用于将内容写入本地文件的工具。
"""

import os
from pydantic import BaseModel, Field
from .base import BaseTool


class FileWriteArgs(BaseModel):
    """文件写入工具的参数定义"""
    file_path: str = Field(..., description="要写入的文件路径（相对路径或绝对路径）")
    content: str = Field(..., description="要写入的文本内容")
    append: bool = Field(False, description="是否使用追加模式（默认覆盖写入）")
    require_new: bool = Field(False, description="是否要求文件必须是新建的（如果文件已存在则报错，防止覆盖）")


class FileWriteTool(BaseTool):
    """
    文件写入工具。
    
    将内容写入指定文件，支持覆盖写入和追加模式。
    自动创建不存在的父目录。
    """
    name = "FileWrite"
    description = "将内容写入指定文件。支持覆盖写入和追加模式。如果父目录不存在会自动创建。可设置 require_new=true 防止覆盖已有文件。"
    args_schema = FileWriteArgs
    
    async def execute(self, file_path: str, content: str, append: bool = False, require_new: bool = False) -> str:
        """
        写入文件。
        
        :param file_path: 文件路径
        :param content: 要写入的内容
        :param append: 是否追加模式
        :param require_new: 是否要求文件必须是新建的
        :return: 操作结果消息
        """
        try:
            # 防覆盖检查
            if require_new and os.path.exists(file_path):
                return f"错误：文件 '{file_path}' 已存在，为防止意外覆盖，写入已拒绝。请选择一个新的文件名。"
            
            # 确保父目录存在
            parent_dir = os.path.dirname(file_path)
            if parent_dir and not os.path.exists(parent_dir):
                os.makedirs(parent_dir, exist_ok=True)
            
            mode = 'a' if append else 'w'
            with open(file_path, mode, encoding='utf-8') as f:
                f.write(content)
            
            action = "追加" if append else "写入"
            return f"成功{action}文件 '{file_path}'，内容长度: {len(content)} 字符"
        except PermissionError:
            return f"错误：没有权限写入文件 '{file_path}'。"
        except Exception as e:
            return f"写入文件时发生错误: {str(e)}"
