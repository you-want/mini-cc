from typing import Dict, List, Optional
from .base import BaseTool
from .bash import BashTool
from .file_read import FileReadTool
from .file_write import FileWriteTool
from src.agent.memory import AddMemoryTool

class ToolRegistry:
    """
    工具注册表，用于管理和分发所有可用的工具。
    Agent 只需要和这个注册表打交道，不需要关心具体有多少工具。
    """
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # 初始化时默认注册一些基础工具
        self.register(BashTool())
        self.register(FileReadTool())
        self.register(FileWriteTool())
        self.register(AddMemoryTool())
        
    def register(self, tool: BaseTool):
        """将工具加入字典"""
        self._tools[tool.name] = tool
        
    def get_tool(self, name: str) -> Optional[BaseTool]:
        """按名字获取工具"""
        return self._tools.get(name)
        
    def get_all_schemas(self) -> List[dict]:
        """
        获取所有已注册工具的 JSON Schema。
        这将被直接放入 OpenAI/兼容接口请求的 `tools` 字段中。
        """
        return [tool.to_openai_schema() for tool in self._tools.values()]
        
    async def execute_tool(self, name: str, args: dict) -> str:
        """
        根据大模型返回的名称和参数，动态找到对应的工具去执行。
        这就是 "Tool Use" 的核心分发逻辑！
        """
        tool = self.get_tool(name)
        if not tool:
            return f"系统错误: 找不到名为 '{name}' 的工具。大模型可能“产生幻觉”并编造了一个工具。"
        
        # 将字典解包作为命名关键字参数传给工具的 execute 函数 (**args)
        return await tool.execute(**args)

# 实例化一个全局单例，整个项目共用这一个注册表
registry = ToolRegistry()
