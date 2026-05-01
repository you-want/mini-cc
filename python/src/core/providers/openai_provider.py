"""
OpenAI 兼容接口提供商 (openai_provider.py)
========================================
封装了官方的 OpenAI Python SDK，用于连接 OpenAI 以及任何支持 OpenAI API 规范的模型（如 Qwen 等）。
负责管理对话上下文 (messages)，处理流式输出，以及解析模型生成的工具调用 (Tool Calls)。
"""

import os
import json
import time
from typing import List, Dict, Callable, Any
from openai import AsyncOpenAI
from src.tools import tools
from .base import LLMProvider

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str = None, model: str = 'gpt-4o'):
        # 初始化异步客户端
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.messages = []
        
        # 设定系统级人设，规定了模型可以使用的能力，并注入了测试目录的特殊约定
        system_prompt = '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。\n\n【防覆盖机制】\n当用户要求“新建”、“生成”某个文件，或者并未明确要求修改旧文件时，你在调用 FileWriteTool 时必须将 `require_new` 参数设置为 `true`。这能保护用户的旧代码不被意外覆盖。如果工具报错提示文件已存在，你应该重新选择一个不同的文件名（例如 `index2.html` 或根据上下文命名）再次尝试，或者向用户确认是否需要覆盖。'
        self.messages.append({"role": "system", "content": system_prompt})

    def get_tools(self):
        """
        将本地的工具列表转换成 OpenAI 接口所要求的格式
        """
        return [{
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["inputSchema"]
            }
        } for t in tools]

    def fix_json_string(self, raw: str) -> str:
        """
        尝试修复大模型生成的带换行符的非法 JSON 字符串。
        """
        return raw.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

    async def create_message(self, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        向模型发起请求的核心方法。
        处理流式返回的数据，包括思维链(reasoning)、普通文本(content)和工具调用参数(tool_calls)。
        """
        request_options = {
            "model": self.model,
            "messages": self.messages,
            "tools": self.get_tools(),
            "temperature": 0.2,
            "stream": True,
            # Qwen 模型专属参数：开启思维链 (reasoning_content)
            "extra_body": {"enable_thinking": True}
        }

        # 发起流式请求
        stream = await self.client.chat.completions.create(**request_options)

        full_content = ''
        full_reasoning = ''
        tool_calls_map = {}
        is_thinking_started = False
        is_content_started = False

        # 遍历流式返回的每一个分块 (chunk)
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if not delta:
                continue
                
            # 处理 Qwen 的思维链输出 (非标准 OpenAI 字段)
            reasoning = getattr(delta, 'reasoning_content', None)
            if reasoning:
                if not is_thinking_started:
                    on_text_response('\n' + '='*20 + ' 思考过程 ' + '='*20 + '\n', True)
                    is_thinking_started = True
                full_reasoning += reasoning
                # is_thinking=True 会让终端显示为灰色
                on_text_response(reasoning, True)
                
            # 处理普通的文本回复
            if delta.content:
                if not is_content_started:
                    on_text_response('\n' + '='*20 + ' 完整回复 ' + '='*20 + '\n', False)
                    is_content_started = True
                full_content += delta.content
                on_text_response(delta.content, False)
                
            # 处理流式的工具调用 (Tool Calls)
            # 由于是流式，工具名称和参数会被切成多个片段，需要拼接起来
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_map:
                        tool_calls_map[idx] = {
                            "id": tc.id or f"call_{int(time.time()*1000)}_{idx}",
                            "type": "function",
                            "function": {"name": tc.function.name or "", "arguments": ""}
                        }
                    else:
                        if tc.id:
                            tool_calls_map[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls_map[idx]["function"]["name"] += tc.function.name
                            
                    if tc.function and tc.function.arguments:
                        tool_calls_map[idx]["function"]["arguments"] += tc.function.arguments

        on_text_response('\n', False)

        # 组装助手的回复以存入历史记录
        assistant_msg = {
            "role": "assistant",
            "content": full_content or None
        }
        
        final_tool_calls = []
        
        # 尝试解析所有收集到的工具调用参数 (JSON)
        for t in tool_calls_map.values():
            args = {}
            raw_args = t["function"]["arguments"] or '{}'
            try:
                try:
                    args = json.loads(raw_args)
                except json.JSONDecodeError:
                    # 如果原生解析失败，尝试修复转义字符后再解析
                    raw_args = self.fix_json_string(raw_args)
                    args = json.loads(raw_args)
            except Exception as e:
                # 解析彻底失败时，打上 _parse_error 标记，交由 Agent 层反馈给模型让其自我修正
                print(f"\n[OpenAIProvider] 工具参数 JSON 解析失败。原始参数:\n{t['function']['arguments']}")
                args = {"_parse_error": True, "_raw_arguments": t["function"]["arguments"]}
                
            final_tool_calls.append({
                "id": t["id"],
                "name": t["function"]["name"],
                "args": args
            })

        # 如果有工具调用，需添加到助手的消息记录中，这是 OpenAI 接口规范要求的
        if final_tool_calls:
            assistant_msg["tool_calls"] = list(tool_calls_map.values())
            
        self.messages.append(assistant_msg)

        return {"text": full_content, "toolCalls": final_tool_calls}

    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        接收用户输入并触发对话
        """
        self.messages.append({"role": "user", "content": user_message})
        return await self.create_message(on_text_response)

    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        将工具执行的结果提交给大模型，让大模型继续思考下一步
        """
        for r in results:
            self.messages.append({
                "role": "tool",
                "tool_call_id": r["id"],
                "content": r["result"]
            })
        return await self.create_message(on_text_response)
