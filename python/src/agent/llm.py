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
        发送对话请求给大模型，并支持流式输出 (Streaming) 和思维链 (Reasoning Content)。
        返回一个字典，包含 AI 说话的文本(content) 以及它想执行的工具(tool_calls)。
        """
        try:
            tools = registry.get_all_schemas()
            
            # 发起 API 请求，使用 stream=True 开启流式响应
            # 开启 enable_thinking 参数以兼容 Qwen 等模型的思维链输出
            response_stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                stream=True,
                extra_body={"enable_thinking": True} # 兼容 Qwen 等支持 reasoning_content 的模型
            )
            
            # 初始化累加器，因为流式返回的是一个字一个字的碎片
            full_content = ""
            full_reasoning = ""
            
            # 记录当前是否正在打印思考过程，用于控制换行和颜色
            is_thinking = False
            
            # 对于工具调用，结构比较复杂，我们需要按索引拼接各个工具的名字和参数
            tool_calls_dict = {}
            
            console.print("\n[ai]🤖 AI:[/ai] ", end="")
            
            # 异步遍历流式响应块
            async for chunk in response_stream:
                if not chunk.choices:
                    continue
                    
                delta = chunk.choices[0].delta
                
                # 1. 提取并打印思维链 (reasoning_content)
                # 注意：并不是所有模型都支持这个字段，所以需要用 getattr 或者 hasattr 安全获取
                reasoning = getattr(delta, 'reasoning_content', None)
                if reasoning:
                    from rich.markup import escape
                    if not is_thinking:
                        console.print("\n[dim cyan]💡 思考过程:[/dim cyan]\n", end="")
                        is_thinking = True
                    full_reasoning += reasoning
                    # 思考过程也需要转义，并且直接用 print 打印，避免 rich 处理其中的中括号
                    # 使用标准库 print，同时设置 flush=True 保证流式输出不卡顿
                    print(f"\033[2;36m{reasoning}\033[0m", end="", flush=True)
                    
                # 如果思考过程结束，开始输出正式内容，我们需要打个换行收尾
                if is_thinking and getattr(delta, 'content', None) is not None:
                    console.print("\n", end="")
                    is_thinking = False
                
                # 2. 提取并打印普通文本内容
                if getattr(delta, 'content', None) is not None:
                    full_content += delta.content
                    # 使用 escape 转义大模型返回的内容，防止内容里碰巧带有像 [error] 这样的中括号导致 rich 崩溃
                    from rich.markup import escape
                    console.print(escape(delta.content), end="")
                    
                # 3. 提取工具调用片段 (tool_calls)
                # 流式返回的 tool_calls 是碎片的，比如第一个块给 id 和 name，后面的块给 arguments 的字母
                if getattr(delta, 'tool_calls', None) is not None:
                    for tc_chunk in delta.tool_calls:
                        index = tc_chunk.index
                        if index not in tool_calls_dict:
                            tool_calls_dict[index] = {
                                "id": tc_chunk.id,
                                "name": tc_chunk.function.name if tc_chunk.function else "",
                                "arguments": ""
                            }
                        
                        if tc_chunk.function and tc_chunk.function.arguments:
                            tool_calls_dict[index]["arguments"] += tc_chunk.function.arguments
                            
            # 流式输出结束，换行收尾
            console.print("\n")
            
            # 组装最终的返回值
            result = {
                "content": full_content,
                "tool_calls": []
            }
            
            # 如果有完整的思维链，我们也可以把它拼接到最终文本里（可选）
            # 或者将其隐藏，只在终端展示。这里我们选择保持最终内容纯净，只返回大模型的正式答复。
            
            # 将收集好的 tool_calls 字典转换为列表，并解析 arguments JSON
            for idx, tc in sorted(tool_calls_dict.items()):
                try:
                    result["tool_calls"].append({
                        "id": tc["id"],
                        "name": tc["name"],
                        "arguments": json.loads(tc["arguments"])
                    })
                except json.JSONDecodeError:
                    console.print(f"[error]解析工具参数 JSON 失败: {tc['arguments']}[/error]")
                    
            return result
            
        except Exception as e:
            console.print(f"\n[error]大模型 API 请求失败: {e}[/error]")
            return {"content": f"系统网络错误: {e}", "tool_calls": []}
