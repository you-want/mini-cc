from typing import List, Dict, Callable, Any, Optional

class LLMProvider:
    async def send_message(self, user_message: str, on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        raise NotImplementedError
        
    async def send_tool_results(self, results: List[Dict[str, Any]], on_text_response: Callable[[str, bool], None]) -> Dict[str, Any]:
        raise NotImplementedError