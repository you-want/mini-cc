"""
工具注册表 (registry.py)
======================

工具注册表用于管理和分发所有可用的工具。
Agent 只需要和这个注册表打交道，不需要关心具体有多少工具。

设计模式：注册表模式（Registry Pattern）
- 所有工具在启动时注册到一个全局单例
- Agent 通过名称查找工具，实现动态分发
- 支持工具别名（如 "BashTool" 和 "Bash" 指向同一个工具）
"""

from typing import Dict, List, Optional
from .base import BaseTool
from .bash import BashTool
from .file_read import FileReadTool
from .file_write import FileWriteTool


class ToolRegistry:
    """
    工具注册表，用于管理和分发所有可用的工具。
    
    Agent 只需要和这个注册表打交道，不需要关心具体有多少工具。
    使用方式：
        registry = ToolRegistry()
        tool = registry.get_tool("FileRead")
        result = await tool.execute(file_path="test.txt")
    """
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # 初始化时默认注册基础工具
        self._register_with_aliases(BashTool(), ["BashTool"])
        self._register_with_aliases(FileReadTool(), ["FileReadTool"])
        self._register_with_aliases(FileWriteTool(), ["FileWriteTool"])
    
    def _register_with_aliases(self, tool: BaseTool, aliases: List[str] = None) -> None:
        """
        注册工具及其别名。
        
        比如 BashTool 的主名称是 "Bash"，但 "BashTool" 也能找到它。
        这样无论大模型返回哪个名字，我们都能正确派发。
        
        :param tool: 工具实例
        :param aliases: 别名列表
        """
        self._tools[tool.name] = tool
        if aliases:
            for alias in aliases:
                self._tools[alias] = tool
        
    def register(self, tool: BaseTool, aliases: List[str] = None) -> None:
        """
        将工具加入注册表。
        
        :param tool: 工具实例
        :param aliases: 可选的别名列表
        """
        self._register_with_aliases(tool, aliases)
        
    def get_tool(self, name: str) -> Optional[BaseTool]:
        """按名字获取工具（支持别名）"""
        return self._tools.get(name)
        
    def list_tools(self) -> List[BaseTool]:
        """
        获取所有已注册的工具（去重）。
        
        因为一个工具可能有多个别名，所以需要去重。
        """
        seen = set()
        unique_tools = []
        for tool in self._tools.values():
            if id(tool) not in seen:
                seen.add(id(tool))
                unique_tools.append(tool)
        return unique_tools
        
    def get_all_schemas(self) -> List[dict]:
        """
        获取所有已注册工具的 OpenAI 兼容 JSON Schema。
        这将被直接放入 LLM API 请求的 `tools` 字段中。
        
        注意：只输出主名称的 schema，不包含别名。
        """
        return [tool.to_openai_schema() for tool in self.list_tools()]
        
    async def execute_tool(self, name: str, args: dict) -> str:
        """
        根据大模型返回的名称和参数，动态找到对应的工具去执行。
        这就是 "Tool Use" 的核心分发逻辑！
        
        :param name: 工具名称（支持别名）
        :param args: 工具参数
        :return: 工具执行结果
        """
        tool = self.get_tool(name)
        if not tool:
            return f"系统错误: 找不到名为 '{name}' 的工具。大模型可能产生幻觉并编造了一个不存在的工具。"
        
        try:
            # 将字典解包作为关键字参数传给工具的 execute 方法
            return await tool.execute(**args)
        except TypeError as e:
            return f"工具 '{name}' 参数错误: {str(e)}\n请检查参数是否正确。"
        except Exception as e:
            return f"工具 '{name}' 执行时发生异常: {str(e)}"


# 实例化一个全局单例，整个项目共用这一个注册表
registry = ToolRegistry()

# 注册记忆工具（延迟导入避免循环依赖）
try:
    from mini_cc.core.memory import AddMemoryTool
    registry.register(AddMemoryTool(), aliases=["AddMemoryTool"])
except ImportError:
    pass  # 如果 memory 模块尚未就绪，跳过
