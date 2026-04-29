import json
import asyncio
from prompt_toolkit import PromptSession
from src.utils.console import console, print_welcome
from src.agent.llm import LLMClient
from src.tools.registry import registry
from src.agent.memory import MemoryManager

async def main_loop():
    """
    Agent 的主事件循环。(这就是让 AI “活起来”的大脑)
    流程：
    1. 接收用户的终端输入。
    2. 把输入发给大模型。
    3. 如果大模型想要调用工具 (tool_calls)，执行工具。
    4. 把执行结果发还给大模型，让它接着思考 (继续步骤 2)，直到它说“任务完成了”。
    5. 输出最终回复给用户，等用户下一次输入。
    """
    print_welcome()
    session = PromptSession()
    
    # 实例化记忆管理器
    memory_manager = MemoryManager()
    
    try:
        llm = LLMClient()
    except Exception as e:
        console.print(f"[error]初始化大模型客户端失败: {e}[/error]")
        console.print("[info]提示：请先运行 `mini-cc config set OPENAI_API_KEY sk-xxx` 来配置你的 Key。[/info]")
        return

    # 全局变量：保存你和大模型的所有对话历史
    # 最开始我们要给 AI 设定一个人设 (System Prompt)
    # 并将之前保存的 .ai_memory 注入进去！
    global_memory = memory_manager.get_global_memory()
    system_prompt = "你是一个强大的 AI 编程助手，类似于 Claude Code。你可以使用提供的工具（比如 BashTool）来执行系统命令。你的思考和分析请用清晰的中文输出。如果需要执行任务，请直接调用工具，不要只是告诉我命令。\n\n"
    
    if global_memory:
        system_prompt += f"=== 项目全局记忆 ===\n{global_memory}\n====================\n\n"
        
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    while True:
        try:
            # 等待用户敲键盘，并按下回车
            user_input = await session.prompt_async("\n> ")
            user_input = user_input.strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ["/exit", "/quit"]:
                console.print("[info]再见！[/info]")
                break
                
            if user_input.lower() == "/clear":
                # 清空历史：把 messages 列表切片到只剩下第一个系统人设
                messages = [messages[0]]
                console.print("[info]对话历史已清空，开启新话题。[/info]")
                continue
                
            if user_input.lower() == "/help":
                console.print("[info]常用命令:[/info]")
                console.print("  /clear  - 清空当前对话历史")
                console.print("  /exit   - 退出应用")
                continue
                
            # --- Agent 核心思考循环开始 ---
            
            # 第一步：把用户的这句话记在历史里，发给大模型
            messages.append({"role": "user", "content": user_input})
            
            # 一个任务可能需要 AI 多次调用工具才能完成（比如：看报错 -> 改代码 -> 再看报错 -> 解决），
            # 所以这里必须有一个死循环（while True），直到 AI 不再想调用工具为止。
            while True:
                # 给终端一点提示，不然等待太久用户以为卡死了
                console.print("[dim cyan]AI 思考中...[/dim cyan]", end="\r")
                
                # 发请求给 OpenAI 接口
                response = await llm.chat(messages)
                
                # 收到回复了，把刚才的“思考中”提示抹掉
                print(" " * 20, end="\r") 
                
                # 第二步：记录 AI 的回复到上下文中
                # 我们需要构造一个属于 "assistant" 角色的消息
                ai_msg = {"role": "assistant"}
                
                # 如果 AI 说了什么文本，我们就把它打印出来，并存下来
                if response["content"]:
                    ai_msg["content"] = response["content"]
                    console.print(f"\n[ai]🤖 AI:[/ai] {response['content']}")
                    
                # 如果 AI 刚才触发了工具调用，我们也要按原样把调用信息存回上下文！
                # 这是 OpenAI 接口的死规定：如果你用了工具，那必须在上下文中体现出来，否则会报错。
                if response["tool_calls"]:
                    ai_msg["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc["arguments"]) # 必须转回 JSON 字符串存入上下文
                            }
                        } for tc in response["tool_calls"]
                    ]
                
                # 将 AI 这一轮的表现存入历史
                messages.append(ai_msg)
                
                # 第三步：检查 AI 的意图，看看这个任务是不是结束了？
                if not response["tool_calls"]:
                    # 如果 AI 的字典里没有 tool_calls，说明它已经没工具可调了，
                    # 它要么是完成了任务在向你汇报，要么是在等你的下一次指令。
                    # 打破思考循环，回到主循环等用户输入。
                    break
                    
                # 第四步：如果 AI 要用工具，我们就老老实实帮它去执行！
                for tc in response["tool_calls"]:
                    tool_name = tc["name"]
                    tool_args = tc["arguments"] # 这已经是一个 Python 字典了，比如 {"command": "ls"}
                    
                    console.print(f"[warning]🔧 工具调用: {tool_name}[/warning] 参数: {tool_args}")
                    
                    # 动态派发执行！
                    tool_result = await registry.execute_tool(tool_name, tool_args)
                    
                    # 终端打印一下执行结果给用户看（截断一点，免得刷屏）
                    preview_res = tool_result[:150].replace("\n", " ") + ("..." if len(tool_result) > 150 else "")
                    console.print(f"[info]  工具返回: {preview_res}[/info]")
                    
                    # 第五步：把工具跑出来的结果，作为一个专门的 "tool" 角色发回给上下文！
                    # 这样 AI 在下一个 while 循环里就能“看”到工具执行成功还是失败了。
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"], # 这个 ID 必须和刚才 AI 呼叫时的 ID 一模一样
                        "name": tool_name,
                        "content": tool_result
                    })
                    
                # for 循环结束（所有的工具都执行完了，结果也都存进了 messages 里），
                # while 循环会继续进行下一轮 -> llm.chat(messages) -> AI 看着执行结果继续下一步动作！
                
        # 捕获 Ctrl+C (KeyboardInterrupt) 和 Ctrl+D (EOFError)
        except KeyboardInterrupt:
            console.print("\n[info]操作被中断。输入 /exit 退出。[/info]")
            continue
        except EOFError:
            console.print("\n[info]再见！[/info]")
            break
        except Exception as e:
            console.print(f"[error]系统发生未捕获异常: {e}[/error]")
