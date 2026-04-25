import json
from openai import AsyncOpenAI
from src.config import get_config_value
from src.utils.console import console
from src.tools.registry import registry

class LLMClient:
    """
    大模型客户端抽象层。
    目前以 OpenAI 的 AsyncOpenAI 作为底层 SDK，这也是目前兼容性最好的格式。
    (大部分国产大模型如 Qwen、DeepSeek 都支持这个接口规范)。
    """
    def __init__(self):
        # 1. 尝试从全局配置里读取我们需要的三个核心参数
        api_key = get_config_value("OPENAI_API_KEY")
        base_url = get_config_value("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        self.model_name = get_config_value("MODEL_NAME") or "gpt-4o"
        
        if not api_key:
            raise ValueError("未配置 OPENAI_API_KEY，大模型服务无法启动。")
            
        # 2. 实例化官方异步客户端
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
    async def chat(self, messages: list) -> dict:
        """
        发送对话请求给大模型。
        返回一个字典，包含 AI 说话的文本(content) 以及它想执行的工具(tool_calls)。
        
        对于初学者来说，这一步就是把"聊天记录"加上"我会的工具列表"，打包发过去，
        然后看大模型是回我一段话，还是甩给我几个工具任务。
        """
        try:
            # 告诉大模型我们目前挂载了哪些工具（这也就是为啥之前要写 to_openai_schema()）
            tools = registry.get_all_schemas()
            
            # 发起 API 请求，等待响应
            # 在 Python 中，涉及网络的请求都应该加 await 以免阻塞主线程
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools,
                # "auto" 表示大模型可以自由决定：是直接回文本，还是调用一个/多个工具
                tool_choice="auto" 
            )
            
            choice = response.choices[0]
            message = choice.message
            
            # 我们把官方庞大的响应体，精简成我们需要处理的两部分
            result = {
                "content": message.content,
                "tool_calls": []
            }
            
            # 3. 检查并提取工具调用 (Tool Use 的关键！)
            if message.tool_calls:
                for tc in message.tool_calls:
                    result["tool_calls"].append({
                        "id": tc.id,              # 每个调用任务的唯一 ID
                        "name": tc.function.name, # 大模型想调哪个工具
                        # 注意：大模型返回的参数是 JSON 格式的字符串，我们需要用 json.loads 转成 Python 的字典
                        "arguments": json.loads(tc.function.arguments)
                    })
                    
            return result
            
        except Exception as e:
            # 万一断网了或者 Key 不对，不至于整个程序崩溃
            console.print(f"[error]大模型 API 请求失败: {e}[/error]")
            return {"content": f"系统网络错误: {e}", "tool_calls": []}
