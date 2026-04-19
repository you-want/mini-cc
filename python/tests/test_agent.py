import pytest
import os
import asyncio
from typing import Callable, Any, Dict, List
from src.core.agent import Agent
from src.core.providers.base import LLMProvider

class MockProvider(LLMProvider):
    def __init__(self):
        self.loop_count = 0
        self.messages = []
        
    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        self.loop_count += 1
        return {
            "text": "Sure, I will execute.",
            "toolCalls": [{
                "id": "call_1",
                "name": "BashTool",
                "args": {"command": "echo 'from mock'"}
            }]
        }
        
    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        self.loop_count += 1
        # Stop after 1 loop
        return {"text": "Done.", "toolCalls": []}

@pytest.mark.asyncio
async def test_agent_loop():
    provider = MockProvider()
    agent = Agent(provider)
    
    def on_text(text, is_thinking=False):
        pass
        
    await agent.chat("Do something", on_text)
    assert provider.loop_count == 2
    
@pytest.mark.asyncio
async def test_agent_parse_error():
    provider = MockProvider()
    agent = Agent(provider)
    
    tool_calls = [{
        "id": "call_err",
        "name": "BashTool",
        "args": {"_parse_error": True, "_raw_arguments": "{bad_json"}
    }]
    
    results = await agent.handle_tool_calls(tool_calls)
    assert len(results) == 1
    assert results[0]["isError"] == True
    assert "[Agent 内部错误]" in results[0]["result"]
