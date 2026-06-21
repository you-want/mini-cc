"""
mini_cc 包初始化文件

这个文件告诉 Python 这是一个可导入的包。
我们在这里导出公共 API。
"""

__version__ = "1.1.0"
__author__ = "rain9"

# 导出核心模块
from .core.agent import Agent
from .core.providers.base import LLMProvider
from .core.providers.openai_provider import OpenAIProvider
from .core.providers.anthropic_provider import AnthropicProvider
from .tools.base import BaseTool
from .tools.registry import ToolRegistry, registry

__all__ = [
    "Agent",
    "LLMProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "BaseTool",
    "ToolRegistry",
    "registry",
]
