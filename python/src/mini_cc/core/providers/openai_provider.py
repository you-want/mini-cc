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
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    """
    OpenAI 兼容接口提供者。
    
    支持 OpenAI 官方 API 以及所有兼容 OpenAI API 规范的服务（如 Qwen、DeepSeek 等）。
    特性：
    - 流式输出（Streaming）
    - 思维链（Reasoning Content，Qwen 等模型支持）
    - 工具调用（Function Calling）
    """
    
    def __init__(self, api_key: str, base_url: str = None, model: str = 'gpt-4o'):
        """
        初始化 OpenAI Provider。
        
        :param api_key: API 密钥
        :param base_url: API 基础 URL（用于兼容接口）
        :param model: 模型名称
        """
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.messages: List[Dict[str, Any]] = []
        
        # 设定系统级人设
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
        self.messages.append({"role": "system", "content": self.system_prompt})

    def _get_tool_schemas(self) -> List[dict]:
        """
        从全局 ToolRegistry 获取所有工具的 OpenAI 兼容 Schema。
        """
        from mini_cc.tools.registry import registry
        return registry.get_all_schemas()

    def _fix_json_string(self, raw: str) -> str:
        """
        尝试修复大模型生成的带换行符的非法 JSON 字符串。
        """
        return raw.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

    async def create_message(self, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """
        向模型发起请求的核心方法。
        处理流式返回的数据，包括思维链(reasoning)、普通文本(content)和工具调用参数(tool_calls)。
        """
        tools = self._get_tool_schemas()
        
        request_options = {
            "model": self.model,
            "messages": self.messages,
            "temperature": 0.2,
            "stream": True,
            "extra_body": {"enable_thinking": True}  # 兼容 Qwen 等支持 reasoning_content 的模型
        }
        
        # 只有当有工具时才传递 tools 参数
        if tools:
            request_options["tools"] = tools
            request_options["tool_choice"] = "auto"

        stream = await self.client.chat.completions.create(**request_options)

        full_content = ''
        full_reasoning = ''
        tool_calls_map = {}
        is_thinking_started = False
        is_content_started = False

        async for chunk in stream:
            if not chunk.choices:
                continue
                
            delta = chunk.choices[0].delta
            
            # 1. 处理 Qwen 的思维链输出
            reasoning = getattr(delta, 'reasoning_content', None)
            if reasoning:
                if not is_thinking_started:
                    on_text_response('\n' + '=' * 20 + ' 思考过程 ' + '=' * 20 + '\n', True)
                    is_thinking_started = True
                full_reasoning += reasoning
                on_text_response(reasoning, True)
                
            # 思维链结束，正式内容开始
            if is_thinking and getattr(delta, 'content', None) is not None:
                on_text_response('\n' + '=' * 20 + ' 完整回复 ' + '=' * 20 + '\n', False)
                is_thinking_started = False
                is_content_started = True
                
            # 2. 处理普通的文本回复
            if delta.content:
                if not is_content_started and not is_thinking_started:
                    pass  # 不需要额外的头部
                full_content += delta.content
                on_text_response(delta.content, False)
                is_content_started = True
                
            # 3. 处理流式的工具调用
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_map:
                        tool_calls_map[idx] = {
                            "id": tc.id or f"call_{int(time.time() * 1000)}_{idx}",
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

        # 组装助手的回复
        assistant_msg: Dict[str, Any] = {
            "role": "assistant",
            "content": full_content or None
        }
        
        final_tool_calls = []
        
        # 解析工具调用参数
        for t in tool_calls_map.values():
            args = {}
            raw_args = t["function"]["arguments"] or '{}'
            try:
                try:
                    args = json.loads(raw_args)
                except json.JSONDecodeError:
                    raw_args = self._fix_json_string(raw_args)
                    args = json.loads(raw_args)
            except Exception as e:
                print(f"\n[OpenAIProvider] 工具参数 JSON 解析失败: {t['function']['arguments']}")
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
        """接收用户输入并触发对话"""
        self.messages.append({"role": "user", "content": user_message})
        return await self.create_message(on_text_response)

    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        """将工具执行结果提交给大模型继续思考"""
        for r in results:
            self.messages.append({
                "role": "tool",
                "tool_call_id": r["id"],
                "content": r["result"]
            })
        return await self.create_message(on_text_response)
