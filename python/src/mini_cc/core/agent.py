"""
核心智能体 (agent.py)
===================

Agent 类负责协调大语言模型与工具之间的交互。
它实现了核心的 Agent 循环：思考 -> 调用工具 -> 观察结果 -> 继续思考。

这是整个 mini-cc 的"大脑"——所有的决策、工具调度、结果汇总都在这里发生。

核心流程：
1. 用户输入 → 发给 LLM（通过 Provider）
2. LLM 回复可能包含工具调用（tool_calls）
3. Agent 解析并执行这些工具调用
4. 将工具执行结果发回给 LLM
5. 重复 2-4，直到 LLM 不再调用工具（给出最终答案）
"""

from typing import Callable, Any, Dict, List, Optional
from mini_cc.tools.registry import registry
from .providers.base import LLMProvider


# Agent 循环的最大次数，防止 AI 无限循环调用工具
MAX_AGENT_LOOPS = 30


class Agent:
    """
    AI Agent 的核心类。
    
    负责：
    1. 处理用户输入
    2. 调用 LLM（通过 Provider 抽象层）获取响应
    3. 解析并执行工具调用（通过 ToolRegistry）
    4. 将工具结果反馈给 LLM
    5. 循环直到 LLM 给出最终答案
    
    设计模式：Agent 是 "协调者"（Orchestrator），
    它自己不处理任何具体的 LLM 调用或工具执行，
    而是委托给 Provider 和 Registry 去完成。
    """
    
    def __init__(self, provider: LLMProvider):
        """
        初始化 Agent。
        
        :param provider: LLM 提供者实例（如 OpenAIProvider、AnthropicProvider）
        """
        self.provider = provider
    
    async def chat(
        self,
        user_input: str,
        on_text_response: Callable[[str, bool], None] = None
    ) -> str:
        """
        处理用户的单次对话请求。
        
        这是 Agent 的主入口。一次 chat() 调用可能会触发多次 LLM 请求
        （因为 AI 可能需要连续调用多个工具才能完成任务）。
        
        :param user_input: 用户输入的文本
        :param on_text_response: 流式输出回调函数
                                 签名: (text: str, is_thinking: bool) -> None
        :return: AI 的最终文本回复
        """
        if on_text_response is None:
            on_text_response = self._default_text_handler
        
        last_text = ""
        
        # 第一步：发送用户消息给 LLM
        response = await self.provider.send_message(user_input, on_text_response)
        last_text = response.get("text", "")
        
        # 第二步：Agent 核心循环 —— 只要 AI 还想调用工具，就一直循环
        loop_count = 0
        while response.get("toolCalls") and loop_count < MAX_AGENT_LOOPS:
            loop_count += 1
            
            # 执行所有工具调用，收集结果
            results = await self.handle_tool_calls(response["toolCalls"])
            
            # 将工具执行结果发回给 LLM，让它继续思考
            response = await self.provider.send_tool_results(results, on_text_response)
            last_text = response.get("text", "")
        
        return last_text
    
    async def handle_tool_calls(
        self,
        tool_calls: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        处理 LLM 返回的工具调用列表。
        
        对于每个工具调用：
        1. 检查是否有参数解析错误（_parse_error）
        2. 在 Registry 中查找对应的工具
        3. 执行工具并收集结果
        
        :param tool_calls: 工具调用列表，每个包含 id, name, args
        :return: 结果列表，每个包含 id, result, isError
        """
        results = []
        
        for tc in tool_calls:
            tc_id = tc.get("id", "")
            tc_name = tc.get("name", "")
            tc_args = tc.get("args", {})
            
            # 检查参数解析错误
            # 当 Provider 在解析 JSON 参数时失败，会标记 _parse_error = True
            if tc_args.get("_parse_error"):
                results.append({
                    "id": tc_id,
                    "result": f"[Agent 内部错误] 工具 '{tc_name}' 的参数 JSON 解析失败。\n"
                              f"原始参数: {tc_args.get('_raw_arguments', 'N/A')}\n"
                              f"请重新尝试调用该工具，确保参数格式正确。",
                    "isError": True
                })
                continue
            
            # 在注册表中查找工具并执行
            tool = registry.get_tool(tc_name)
            if not tool:
                results.append({
                    "id": tc_id,
                    "result": f"错误：找不到名为 '{tc_name}' 的工具。"
                              f"可用的工具有: {', '.join(t.name for t in registry.list_tools())}",
                    "isError": True
                })
                continue
            
            try:
                result = await tool.execute(**tc_args)
                results.append({
                    "id": tc_id,
                    "result": result,
                    "isError": False
                })
            except Exception as e:
                results.append({
                    "id": tc_id,
                    "result": f"工具 '{tc_name}' 执行时发生异常: {str(e)}",
                    "isError": True
                })
        
        return results
    
    def clear_history(self) -> None:
        """
        清空对话历史（保留系统提示词）。
        
        用于 /clear 命令，让用户可以开始新的话题。
        """
        if hasattr(self.provider, 'messages'):
            # 只保留系统提示（第一条消息）
            self.provider.messages = self.provider.messages[:1]
    
    @staticmethod
    def _default_text_handler(text: str, is_thinking: bool) -> None:
        """默认的文本输出处理器（直接打印到终端）"""
        print(text, end="", flush=True)
