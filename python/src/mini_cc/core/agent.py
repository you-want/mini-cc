"""
核心智能体 (agent.py)
===================

Agent 类负责协调大语言模型与工具之间的交互。
它实现了核心的 Agent 循环：思考 -> 调用工具 -> 观察结果 -> 继续思考。
"""

from typing import Callable, Any, Dict, List
from mini_cc.tools import tools
from .providers.base import LLMProvider

class Agent:
    """
    AI Agent 的核心类。
    
    负责：
    1. 处理用户输入
    2. 调用 LLM 获取响应
    3. 解析并执行工具调用
    4. 返回最终回答
    """
    
    def __init__(self, provider: LLMProvider):
        """
        初始化 Agent。
        
        :param provider: LLM 提供者实例（如 OpenAIProvider、AnthropicProvider）
        """
        self.provider = provider
        self.messages: List[Dict[str, str]] = []  # 对话历史
    
    async def chat(self, user_input: str, on_text_response: Callable[[str, bool], None] = None):
        """
        处理用户的单次对话请求。
        
        :param user_input: 用户输入的文本
        :param on_text_response: 流式输出回调函数
        """
        # 添加用户消息到对话历史
        self.messages.append({"role": "user", "content": user_input})
        
        # 调用 LLM 获取响应（这里先用模拟响应）
        response = await self._get_response(user_input)
        
        # 解析工具调用
        tool_calls = self._parse_tool_calls(response)
        
        if tool_calls:
            # 执行工具调用
            results = await self._execute_tools(tool_calls)
            
            # 将工具执行结果加入对话历史
            self.messages.append({
                "role": "tool", 
                "content": str(results)
            })
            
            # 再次调用 LLM 获取最终回复
            final_response = await self._get_response(user_input, results)
            if on_text_response:
                on_text_response(final_response, False)
            else:
                print(final_response)
        else:
            # 直接返回回答
            if on_text_response:
                on_text_response(response, False)
            else:
                print(response)
    
    async def _get_response(self, user_input: str, tool_results: Any = None) -> str:
        """
        获取 LLM 的响应（模拟实现）。
        
        在实际实现中，这里会调用真实的 LLM API。
        """
        if tool_results:
            # 如果有工具执行结果，生成包含结果的响应
            return f"根据工具执行结果，我来总结一下：\n{tool_results}"
        else:
            # 模拟 LLM 响应（包含工具调用）
            # 这是一个简化的模拟，实际中会由真实 LLM 决定是否调用工具
            if "文件" in user_input or "读取" in user_input:
                return '{"tool_calls": [{"name": "file_read", "args": {"file_path": "test.txt"}}]}'
            elif "命令" in user_input or "执行" in user_input:
                return '{"tool_calls": [{"name": "bash", "args": {"command": "echo hello"}}]}'
            else:
                return f"你说的是：{user_input}\n\n这是一个模拟响应。在实际应用中，这里会调用真实的 LLM API。"
    
    def _parse_tool_calls(self, response: str) -> List[Dict[str, Any]]:
        """
        解析 LLM 响应中的工具调用。
        
        :param response: LLM 的响应文本
        :return: 工具调用列表
        """
        import json
        
        try:
            if 'tool_calls' in response:
                data = json.loads(response)
                return data.get('tool_calls', [])
        except json.JSONDecodeError:
            pass
        
        return []
    
    async def _execute_tools(self, tool_calls: List[Dict[str, Any]]) -> str:
        """
        执行工具调用。
        
        :param tool_calls: 工具调用列表
        :return: 工具执行结果
        """
        results = []
        
        for call in tool_calls:
            tool_name = call.get("name")
            args = call.get("args", {})
            
            # 在已注册的工具中查找
            found_tool = None
            for tool in tools:
                if tool.name == tool_name:
                    found_tool = tool
                    break
            
            if found_tool:
                try:
                    # 执行工具函数
                    result = found_tool.func(**args)
                    results.append({
                        "tool": tool_name,
                        "result": result,
                        "success": True
                    })
                except Exception as e:
                    results.append({
                        "tool": tool_name,
                        "result": str(e),
                        "success": False
                    })
            else:
                results.append({
                    "tool": tool_name,
                    "result": f"未知工具: {tool_name}",
                    "success": False
                })
        
        # 格式化结果
        return "\n\n".join([
            f"工具: {r['tool']}\n结果: {r['result']}" 
            for r in results
        ])
