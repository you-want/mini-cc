"""
大模型提供商基础接口 (base.py)
============================
定义了所有 LLM Provider 必须实现的抽象接口。
通过这个抽象层，Agent 可以无缝切换底层的 AI 模型（如 OpenAI、Anthropic、Qwen 等），
而不需要关心具体的 API 调用细节。
"""

from typing import List, Dict, Callable, Any, Optional

class LLMProvider:
    """
    大语言模型提供商的抽象基类。
    """
    
    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        发送用户消息并获取模型的回复。
        
        :param user_message: 用户的输入文本
        :param on_text_response: 用于处理流式输出的回调函数。
                                 签名: (text: str, is_thinking: bool) -> None
                                 is_thinking 用于标识该文本是否属于模型的“思维链”输出。
        :return: 包含最终文本和工具调用列表的字典
                 结构示例: {"text": "...", "toolCalls": [{"name": "...", "args": {...}}]}
        """
        raise NotImplementedError
        
    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        将本地工具的执行结果发送给模型，让模型继续思考和回复。
        
        :param results: 工具执行结果的列表。每个元素应包含 id, result, (可选的) isError 等字段。
        :param on_text_response: 用于处理流式输出的回调函数，同上。
        :return: 同 send_message 的返回值结构。
        """
        raise NotImplementedError