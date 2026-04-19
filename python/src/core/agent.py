"""
核心智能体 (agent.py)
===================
Agent 类负责协调大语言模型 (LLMProvider) 与本地工具 (Tools) 之间的交互。
它实现了核心的 "思考-调用工具-观察结果-继续思考" (ReAct) 循环。
"""

import json
from typing import Callable, Any, Dict
from src.tools import tools
from .providers import LLMProvider

class Agent:
    def __init__(self, provider: LLMProvider):
        # 注入底层模型驱动 (如 OpenAIProvider 或 AnthropicProvider)
        self.provider = provider

    async def handle_tool_calls(self, tool_calls: list) -> list:
        """
        处理模型发出的工具调用请求。
        遍历模型要求的每个工具调用，执行对应的本地 Python 函数，并将结果组装返回。
        """
        results = []
        
        for call in tool_calls:
            args = call.get("args", {})
            
            # 1. 检查底层模型是否输出了损坏的 JSON (由 Provider 层捕获并打上的标记)
            # 如果解析失败，直接将错误信息作为执行结果返回给模型，让模型自我纠正
            if args.get("_parse_error"):
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n你输出的原始参数为:\n{args.get('_raw_arguments')}",
                    "isError": True
                })
                continue
                
            # 2. 在已注册的工具列表中查找匹配的工具
            tool = next((t for t in tools if t["name"] == call["name"]), None)
            
            # 如果模型幻觉，调用了不存在的工具，同样返回错误信息让其重试
            if not tool:
                print(f"\033[31m[Agent] 未知工具: {call['name']}\033[0m")
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"未知的工具调用: {call['name']}",
                    "isError": True
                })
                continue
                
            # 3. 正常执行工具逻辑
            try:
                print(f"\033[36m▶ [Agent] 正在调用工具: {call['name']} ...\033[0m")
                # 异步执行工具的具体功能 (如读写文件、执行 Bash 等)
                result = await tool["execute"](args)
                print(f"\033[32m✔ [Agent] 工具 {call['name']} 执行完毕。\033[0m")
                
                # 4. 上下文瘦身 (Context Microcompact)
                # 防止工具返回结果过大 (如 ls 打印了数万个文件) 撑爆大模型的上下文窗口
                if isinstance(result, str) and len(result) > 8000:
                    print(f"\n[上下文瘦身] 工具 {call['name']} 返回结果过长 ({len(result)} 字符)，已触发 microcompact 截断。")
                    result = result[:8000] + '\n\n...[由于内容过长，已被系统 microcompact 机制截断]...'
                    
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": result,
                    "isError": False
                })
            except Exception as e:
                # 捕获工具执行过程中的崩溃/异常，防止整个 Agent 退出
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"执行工具 {call['name']} 时出错: {str(e)}",
                    "isError": True
                })
                
        return results

    async def chat(self, user_message: str, on_text_response: Callable[[str, bool], None]):
        """
        处理用户的单次对话请求，包含完整的 Tool Call 循环。
        """
        try:
            # 第一次请求：将用户输入发给模型，并接收模型的回复 (包括纯文本回复和工具调用)
            response = await self.provider.send_message(user_message, on_text_response)
            
            loop_count = 0
            max_loops = 3  # 防止模型陷入死循环（如不断调用失败又不断重试）
            
            # 进入 Agent 核心循环：只要模型有未处理的工具调用，就继续循环
            while response.get("toolCalls") and len(response["toolCalls"]) > 0:
                loop_count += 1
                
                # 安全熔断机制
                if loop_count > max_loops:
                    print(f"\n\033[33m[Agent] 工具调用循环次数过多 ({loop_count})，为防止无限循环，已强制终止。\033[0m")
                    break
                    
                print(f"\n\033[33m[Agent] 收到大模型指令，准备执行 {len(response['toolCalls'])} 个工具调用... (第 {loop_count} 轮)\033[0m")
                
                # 统一执行本轮产生的所有工具调用
                tool_results = await self.handle_tool_calls(response["toolCalls"])
                
                print(f"\n\033[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\033[0m\n")
                
                # 将工具执行结果作为新的轮次发送给大模型，让大模型 "观察" 结果并决定下一步
                response = await self.provider.send_tool_results(tool_results, on_text_response)
                
        except Exception as e:
            # 捕获整个对话过程中的底层网络异常等
            print(f"\n[Agent 报错] {str(e)}")