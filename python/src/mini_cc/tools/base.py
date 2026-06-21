"""
工具基类 (base.py)
================

定义了工具的基础结构和注册机制。
支持两种工具定义方式：
1. BaseTool 类（Pydantic 风格，推荐）- 用于新工具
2. Tool dataclass + register_tool 装饰器 - 向后兼容
"""

from abc import ABC, abstractmethod
from typing import Callable, Any, List, Dict, Optional, Type
from dataclasses import dataclass
from pydantic import BaseModel


class BaseTool(ABC):
    """
    工具抽象基类（Pydantic 风格）。
    
    所有新工具都应继承此类，并实现 execute() 方法。
    
    属性:
        name: 工具名称（大模型通过这个识别工具）
        description: 工具描述（大模型靠这个决定是否调用）
        args_schema: Pydantic 模型，定义工具的输入参数
    """
    name: str = ""
    description: str = ""
    args_schema: Type[BaseModel] = BaseModel
    
    def to_openai_schema(self) -> dict:
        """
        将工具转换为 OpenAI API 兼容的 JSON Schema 格式。
        
        利用 Pydantic 自带的 model_json_schema() 方法，
        自动生成符合 JSON Schema 规范的参数描述。
        """
        schema = self.args_schema.model_json_schema()
        
        # Pydantic 生成的 schema 中可能包含 'title' 字段，
        # OpenAI API 不需要这个，我们清理掉
        schema.pop("title", None)
        
        # 清理 properties 中每个字段的 title
        for prop in schema.get("properties", {}).values():
            prop.pop("title", None)
        
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": schema
            }
        }
    
    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """
        执行工具逻辑。子类必须实现此方法。
        
        :param kwargs: 工具参数（由大模型提供）
        :return: 工具执行结果字符串
        """
        pass


# ============================================================
# 以下为旧版 Tool dataclass 和 register_tool 装饰器
# 保留用于向后兼容（文档第6章教学用）
# ============================================================

@dataclass
class Tool:
    """
    工具的基础数据结构（旧版，用于向后兼容）。
    
    每个工具包含：
    - name: 工具名称
    - description: 工具描述
    - func: 实际执行的函数
    - input_schema: 输入参数的 JSON Schema
    """
    name: str
    description: str
    func: Callable[..., Any]
    input_schema: dict

# 全局工具列表（所有通过装饰器注册的工具都会放在这里）
tools: List[Tool] = []


def register_tool(name: str, description: str, input_schema: dict = None):
    """
    工具注册装饰器（旧版，用于向后兼容）。
    
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
