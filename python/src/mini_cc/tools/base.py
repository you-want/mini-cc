"""
工具基类 (base.py)
================

定义了工具的基础结构和注册机制。
这是 AI 能够调用外部工具的核心。
"""

from typing import Callable, Any, List
from dataclasses import dataclass

@dataclass
class Tool:
    """
    工具的基础数据结构。
    
    每个工具包含：
    - name: 工具名称（用于大模型识别）
    - description: 工具描述（大模型靠这个决定是否调用）
    - func: 实际执行的函数
    - input_schema: 输入参数的 JSON Schema
    """
    name: str
    description: str
    func: Callable[..., Any]
    input_schema: dict

# 全局工具列表（所有注册的工具都会放在这里）
tools: List[Tool] = []

def register_tool(name: str, description: str, input_schema: dict = None):
    """
    工具注册装饰器。
    
    使用方式：
    @register_tool(
        name="file_read",
        description="读取文件内容",
        input_schema={"file_path": {"type": "string"}}
    )
    def file_read(file_path: str) -> str:
        # ... 实现逻辑
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        tools.append(Tool(
            name=name,
            description=description,
            func=func,
            input_schema=input_schema or {}
        ))
        return func
    return decorator
