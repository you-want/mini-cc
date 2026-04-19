import json
from typing import Callable, Any, Dict
from src.tools import tools
from .providers import LLMProvider

class Agent:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def handle_tool_calls(self, tool_calls: list) -> list:
        results = []
        
        for call in tool_calls:
            args = call.get("args", {})
            if args.get("_parse_error"):
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n你输出的原始参数为:\n{args.get('_raw_arguments')}",
                    "isError": True
                })
                continue
                
            tool = next((t for t in tools if t["name"] == call["name"]), None)
            if not tool:
                print(f"\033[31m[Agent] 未知工具: {call['name']}\033[0m")
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"未知的工具调用: {call['name']}",
                    "isError": True
                })
                continue
                
            try:
                print(f"\033[36m▶ [Agent] 正在调用工具: {call['name']} ...\033[0m")
                result = await tool["execute"](args)
                print(f"\033[32m✔ [Agent] 工具 {call['name']} 执行完毕。\033[0m")
                
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
                results.append({
                    "id": call["id"],
                    "name": call["name"],
                    "result": f"执行工具 {call['name']} 时出错: {str(e)}",
                    "isError": True
                })
                
        return results

    async def chat(self, user_message: str, on_text_response: Callable[[str, bool], None]):
        try:
            response = await self.provider.send_message(user_message, on_text_response)
            
            loop_count = 0
            max_loops = 5
            
            while response.get("toolCalls") and len(response["toolCalls"]) > 0:
                loop_count += 1
                if loop_count > max_loops:
                    print(f"\n\033[33m[Agent] 工具调用循环次数过多 ({loop_count})，为防止无限循环，已强制终止。\033[0m")
                    break
                    
                print(f"\n\033[33m[Agent] 收到大模型指令，准备执行 {len(response['toolCalls'])} 个工具调用... (第 {loop_count} 轮)\033[0m")
                tool_results = await self.handle_tool_calls(response["toolCalls"])
                
                print(f"\n\033[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\033[0m\n")
                response = await self.provider.send_tool_results(tool_results, on_text_response)
                
        except Exception as e:
            print(f"\n[Agent 报错] {str(e)}")