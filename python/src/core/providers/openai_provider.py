import os
import json
import time
from typing import List, Dict, Callable, Any
from openai import AsyncOpenAI
from src.tools import tools
from .base import LLMProvider

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str = None, model: str = 'gpt-4o'):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.messages = []
        
        system_prompt = '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。'
        self.messages.append({"role": "system", "content": system_prompt})

    def get_tools(self):
        return [{
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["inputSchema"]
            }
        } for t in tools]

    def fix_json_string(self, raw: str) -> str:
        return raw.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

    async def create_message(self, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        request_options = {
            "model": self.model,
            "messages": self.messages,
            "tools": self.get_tools(),
            "temperature": 0.2,
            "stream": True,
            # Qwen specific parameter
            "extra_body": {"enable_thinking": True}
        }

        stream = await self.client.chat.completions.create(**request_options)

        full_content = ''
        full_reasoning = ''
        tool_calls_map = {}
        is_thinking_started = False
        is_content_started = False

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if not delta:
                continue
                
            # @ts-ignore equivalent for python dynamic attributes
            reasoning = getattr(delta, 'reasoning_content', None)
            if reasoning:
                if not is_thinking_started:
                    on_text_response('\n' + '='*20 + ' 思考过程 ' + '='*20 + '\n', True)
                    is_thinking_started = True
                full_reasoning += reasoning
                on_text_response(reasoning, True)
                
            if delta.content:
                if not is_content_started:
                    on_text_response('\n' + '='*20 + ' 完整回复 ' + '='*20 + '\n', False)
                    is_content_started = True
                full_content += delta.content
                on_text_response(delta.content, False)
                
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

        assistant_msg = {
            "role": "assistant",
            "content": full_content or None
        }
        
        final_tool_calls = []
        for t in tool_calls_map.values():
            args = {}
            raw_args = t["function"]["arguments"] or '{}'
            try:
                try:
                    args = json.loads(raw_args)
                except json.JSONDecodeError:
                    raw_args = self.fix_json_string(raw_args)
                    args = json.loads(raw_args)
            except Exception as e:
                print(f"\n[OpenAIProvider] 工具参数 JSON 解析失败。原始参数:\n{t['function']['arguments']}")
                args = {"_parse_error": True, "_raw_arguments": t["function"]["arguments"]}
                
            final_tool_calls.append({
                "id": t["id"],
                "name": t["function"]["name"],
                "args": args
            })

        if final_tool_calls:
            assistant_msg["tool_calls"] = list(tool_calls_map.values())
            
        self.messages.append(assistant_msg)

        return {"text": full_content, "toolCalls": final_tool_calls}

    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        self.messages.append({"role": "user", "content": user_message})
        return await self.create_message(on_text_response)

    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        for r in results:
            self.messages.append({
                "role": "tool",
                "tool_call_id": r["id"],
                "content": r["result"]
            })
        return await self.create_message(on_text_response)
