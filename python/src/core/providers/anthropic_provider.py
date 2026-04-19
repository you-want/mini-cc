"""
Anthropic 模型接口提供商 (anthropic_provider.py)
==============================================
封装了官方的 Anthropic Python SDK，用于连接 Claude 系列模型。
由于 Anthropic 的 API 结构与 OpenAI 差异较大 (特别是消息结构、系统提示词位置和工具调用机制)，
因此我们单独实现了一个 Provider 来适配其流式返回机制。
"""

import json
from typing import Callable, Any, Dict, List
from anthropic import AsyncAnthropic
from .base import LLMProvider
from src.tools import tools

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = 'claude-3-7-sonnet-20250219'):
        # 初始化 Anthropic 异步客户端
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.messages = []
        # Anthropic 的 System Prompt 不能混在 messages 数组里，而是要在请求时单独指定
        self.system_prompt = "You are an intelligent assistant capable of executing system tools to help users solve problems."
        
    def get_tools(self) -> List[Dict[str, Any]]:
        """
        将本地的工具列表转换成 Anthropic 接口所要求的格式
        """
        return [{
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["inputSchema"]
        } for t in tools]
        
    def fix_json_string(self, raw_str: str) -> str:
        """
        作为备用的 JSON 修复工具 (通常 Claude 输出的 JSON 会比其他模型标准，但也可能出问题)
        """
        # Anthropic might output valid JSON natively, but we keep this as fallback
        s = raw_str.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
        s = s.replace('\\"', '"')
        return s

    async def create_message(self, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        向 Claude 发起流式请求并处理返回。
        Anthropic 的 SDK 提供了一个高层的 messages.stream 上下文管理器，
        它会自动帮我们合并流式的工具调用分块，大大简化了手动拼接的过程。
        """
        full_content = ""
        tool_calls_map = {}
        
        # 使用 Anthropic SDK 自带的 streaming 上下文管理器
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=4096,
            temperature=0.2,
            system=self.system_prompt,  # 单独传递 system prompt
            messages=self.messages,
            tools=self.get_tools()
        ) as stream:
            # 实时监听文本生成事件，输出给用户
            async for event in stream:
                if event.type == "text_delta":
                    full_content += event.delta.text
                    on_text_response(event.delta.text, False)
                elif event.type == "tool_use":
                    # 对于工具调用事件，我们不需要手动拼接，SDK 的 stream.get_final_message() 会帮我们做
                    pass
            
            # 自动获取拼接完成的最终完整消息对象
            final_message = await stream.get_final_message()
            
        # 解析最终消息对象
        final_tool_calls = []
        assistant_content = []
        
        # Anthropic 的 content 是一个数组，可能同时包含 text 块和 tool_use 块
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
                    "input": block.input  # input 已经是被 SDK 解析好的 Python dict 对象了
                })
                
                # 我们按照 Agent 层的标准格式重新组装 Tool Call
                args = block.input
                final_tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "args": args
                })
                
        # 将助手的回复添加到历史记录中，用于后续轮次的上下文
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
                "is_error": r.get("isError", False)  # 告诉 Claude 工具是否执行失败
            })
            
        self.messages.append({
            "role": "user",
            "content": tool_result_content
        })
        
        return await self.create_message(on_text_response)
