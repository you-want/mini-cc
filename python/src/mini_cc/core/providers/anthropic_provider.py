"""
Anthropic 模型接口提供商 (anthropic_provider.py)
==============================================

封装了官方的 Anthropic Python SDK，用于连接 Claude 系列模型。
由于 Anthropic 的 API 结构与 OpenAI 差异较大（特别是消息结构、系统提示词位置和工具调用机制），
因此我们单独实现了一个 Provider 来适配其流式返回机制。
"""

import json
from typing import Callable, Any, Dict, List
from anthropic import AsyncAnthropic
from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    """
    Anthropic Claude 提供者。
    
    特性：
    - 流式输出（Streaming via messages.stream）
    - 工具调用（Tool Use）
    - 系统提示词单独管理
    """
    
    def __init__(self, api_key: str, model: str = 'claude-sonnet-4-20250514'):
        """
        初始化 Anthropic Provider。
        
        :param api_key: Anthropic API 密钥
        :param model: 模型名称
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.messages: List[Dict[str, Any]] = []
        
        self.system_prompt = (
            '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。'
            '你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n'
            '【默认输出目录】\n'
            '如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，'
            '请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。\n\n'
            '【防覆盖机制】\n'
            '当用户要求"新建"、"生成"某个文件，或者并未明确要求修改旧文件时，'
            '你在调用 FileWrite 时必须将 `require_new` 参数设置为 `true`。'
        )
        
    def _get_tool_schemas(self) -> List[Dict[str, Any]]:
        """
        从全局 ToolRegistry 获取工具列表，并转换为 Anthropic 格式。
        
        Anthropic 的工具格式与 OpenAI 不同：
        - OpenAI: {"type": "function", "function": {"name": ..., "parameters": ...}}
        - Anthropic: {"name": ..., "input_schema": ...}
        """
        from mini_cc.tools.registry import registry
        result = []
        for tool in registry.list_tools():
            schema = tool.to_openai_schema()
            result.append({
                "name": schema["function"]["name"],
                "description": schema["function"]["description"],
                "input_schema": schema["function"]["parameters"]
            })
        return result
        
    async def create_message(self, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        向 Claude 发起流式请求并处理返回。
        
        Anthropic 的 SDK 提供了 messages.stream 上下文管理器，
        它会自动帮我们合并流式的工具调用分块，大大简化了手动拼接的过程。
        """
        full_content = ""
        tools = self._get_tool_schemas()
        
        request_kwargs: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": 4096,
            "temperature": 0.2,
            "system": self.system_prompt,
            "messages": self.messages,
        }
        
        # 只有当有工具时才传递
        if tools:
            request_kwargs["tools"] = tools
        
        async with self.client.messages.stream(**request_kwargs) as stream:
            async for event in stream:
                if event.type == "text_delta":
                    full_content += event.delta.text
                    on_text_response(event.delta.text, False)
            
            final_message = await stream.get_final_message()
            
        # 解析最终消息
        final_tool_calls = []
        assistant_content = []
        
        for block in final_message.content:
            if block.type == "text":
                assistant_content.append({
                    "type": "text",
                    "text": block.text
                })
            elif block.type == "tool_use":
                assistant_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                })
                
                final_tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "args": block.input
                })
                
        # 将助手回复添加到历史记录
        self.messages.append({
            "role": "assistant",
            "content": assistant_content
        })
        
        on_text_response("\n", False)
        
        return {"text": full_content, "toolCalls": final_tool_calls}

    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """接收用户输入并触发对话"""
        self.messages.append({"role": "user", "content": user_message})
        return await self.create_message(on_text_response)

    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        将工具执行结果反馈给 Claude。
        
        注意：Anthropic 要求 tool_result 必须包装在一个 role="user" 的消息中。
        """
        tool_result_content = []
        for r in results:
            tool_result_content.append({
                "type": "tool_result",
                "tool_use_id": r["id"],
                "content": r["result"],
                "is_error": r.get("isError", False)
            })
            
        self.messages.append({
            "role": "user",
            "content": tool_result_content
        })
        
        return await self.create_message(on_text_response)
