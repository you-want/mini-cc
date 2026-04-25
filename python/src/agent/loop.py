import asyncio
from prompt_toolkit import PromptSession
from src.utils.console import console, print_welcome

async def main_loop():
    """
    Agent 的主事件循环。
    在这里接收用户的输入，然后交给大模型进行处理。
    """
    print_welcome()
    
    # 使用 prompt_toolkit，它比自带的 input() 更强大，支持多行、历史记录、语法高亮等
    session = PromptSession()
    
    while True:
        try:
            # 阻塞等待用户输入，HTML 样式的提示符
            user_input = await session.prompt_async("\n> ")
            
            # 去除首尾空格
            user_input = user_input.strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ["/exit", "/quit"]:
                console.print("[info]再见！[/info]")
                break
                
            if user_input.lower() == "/help":
                console.print("[info]常用命令:[/info]")
                console.print("  /clear  - 清空当前对话历史")
                console.print("  /exit   - 退出应用")
                continue
                
            # TODO: 将用户输入传递给大模型，并执行 Agent 循环
            console.print(f"[ai]AI 收到了你的消息：[/ai] {user_input}")
            console.print("[warning](大模型调用功能正在开发中...)[/warning]")
            
        # 捕获 Ctrl+C (KeyboardInterrupt) 和 Ctrl+D (EOFError)
        except KeyboardInterrupt:
            console.print("\n[info]操作被中断。输入 /exit 退出。[/info]")
            continue
        except EOFError:
            console.print("\n[info]再见！[/info]")
            break
        except Exception as e:
            console.print(f"[error]发生错误: {e}[/error]")
