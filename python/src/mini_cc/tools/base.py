from typing import Any
from pydantic import BaseModel

class BaseTool:
    """
    所有工具的基类。
    在 Python 中，我们可以利用 Pydantic 来定义工具的参数 schema，
    这样可以自动生成大模型（如 OpenAI 接口）需要的 JSON Schema 格式。
    """
    # 工具名称（只能包含字母、数字、下划线和连字符，最大长度 64）
    name: str = ""
    # 工具描述（越详细越好，这是大模型决定是否调用它的唯一依据）
    description: str = ""
    
    # 使用 Pydantic 的 BaseModel 来定义参数结构
    args_schema: type[BaseModel] = BaseModel
    
    async def execute(self, **kwargs) -> str:
        """执行工具逻辑，必须由子类实现"""
        raise NotImplementedError("子类必须实现 execute 方法")
        
    def to_openai_schema(self) -> dict:
        """
        将工具定义转换为 OpenAI/兼容接口所需的 tools 格式
        这是大模型能“看懂”你有哪些工具的关键。
        """
        # Pydantic 提供了一个非常方便的 model_json_schema() 方法
        # 它可以直接把 Python 的数据类转成符合 JSON Schema 规范的字典
        schema = self.args_schema.model_json_schema()
        
        # 移除一些大模型 API 可能不支持的额外字段（比如 Pydantic 自动生成的 title）
        if "title" in schema:
            del schema["title"]
            
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": schema
            }
        }
