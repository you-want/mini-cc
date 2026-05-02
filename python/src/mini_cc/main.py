"""
主程序入口点 (main.py)
===================
这个文件是 mini-cc Python 版本的入口。它负责：
1. 初始化环境变量 (如 API Key)
2. 根据配置选择底层模型供应商 (OpenAI 或 Anthropic)
3. 创建 Agent 实例并启动交互式命令行循环 (REPL)
4. 处理用户输入的特殊命令 (如 /help, /clear, /buddy)
"""

import os
import sys
import asyncio
from dotenv import load_dotenv
import colorama
import readline

# 确保 src 目录可以被正确引用 (解决模块导入路径问题)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mini_cc.core.agent import Agent
from mini_cc.core.providers.openai_provider import OpenAIProvider
from mini_cc.core.providers.anthropic_provider import AnthropicProvider
from mini_cc.buddy.companion import spawn_buddy

async def main():
    # 初始化终端颜色输出 (Windows 兼容)
    colorama.init()
    
    # 尝试加载环境变量 (优先级: 当前目录 .env > 用户主目录 ~/.mini-cc-env > 用户主目录 ~/.env)
    try:
        from dotenv import load_dotenv
        # 1. 先尝试加载主目录全局配置
        home_env_mini = os.path.join(os.path.expanduser("~"), ".mini-cc-env")
        home_env = os.path.join(os.path.expanduser("~"), ".env")
        if os.path.exists(home_env_mini):
            load_dotenv(dotenv_path=home_env_mini)
        elif os.path.exists(home_env):
            load_dotenv(dotenv_path=home_env)
            
        # 2. 当前目录的 .env 优先级最高，会覆盖主目录的配置
        load_dotenv(override=True)
    except ImportError:
        pass

    # 解析命令行参数 (支持 -v / --version 快速查看版本)
    args = sys.argv[1:]
    if len(args) == 1 and args[0] in ['--version', '-v']:
        print('mini-cc python v1.0.0 (Fast-path)')
        sys.exit(0)

    # 从环境变量中读取并决定使用哪个模型提供商，默认为 openai
    provider_name = os.environ.get('PROVIDER', 'openai').lower()
    
    # 初始化对应的模型 Provider
    if provider_name == 'openai':
        api_key = os.environ.get('OPENAI_API_KEY', '')
        base_url = os.environ.get('OPENAI_BASE_URL')
        model_name = os.environ.get('MODEL_NAME', 'qwen3.6-plus')

        if not api_key:
            print('\033[31m错误：未设置 OPENAI_API_KEY 环境变量。\033[0m')
            sys.exit(1)
            
        provider_instance = OpenAIProvider(api_key, base_url, model_name)
        
    elif provider_name == 'anthropic':
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        model_name = os.environ.get('MODEL_NAME', 'claude-3-7-sonnet-20250219')
        
        if not api_key:
            print('\033[31m错误：未设置 ANTHROPIC_API_KEY 环境变量。\033[0m')
            sys.exit(1)
            
        provider_instance = AnthropicProvider(api_key, model_name)
    else:
        print(f'\033[31mPython 版本不支持 {provider_name}。支持: openai, anthropic\033[0m')
        sys.exit(1)

    # 实例化核心智能体
    agent = Agent(provider_instance)

    # 打印类似 TS 版的 ASCII 启动欢迎信息
    version = '1.0.0'
    user_name = os.environ.get('USER', 'developer')
    cwd = os.getcwd()
    homedir = os.path.expanduser("~")
    display_cwd = f"~{cwd[len(homedir):]}" if cwd.startswith(homedir) else cwd
    provider_display = 'OpenAI / Compatible' if provider_name == 'openai' else 'Anthropic'
    
    u_disp = user_name[:15] + '...' if len(user_name) > 15 else user_name
    m_disp = model_name[:22] + '...' if len(model_name) > 22 else model_name
    c_disp = display_cwd[:35] + '...' if len(display_cwd) > 35 else display_cwd
    
    c_box = '\033[38;2;204;255;0m'
    c_title = '\033[36m\033[1m'
    c_cyan = '\033[36m'
    c_blue = '\033[34m\033[4m'
    c_gray = '\033[90m'
    c_yellow = '\033[33m'
    c_bg = '\033[48;2;5;5;5m'
    res = '\033[0m'
    
    lines = [
        (f"mini-cc CLI {version}", f"{c_title}mini-cc CLI {version}{res}", "", ""),
        ("▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄", f"{c_box}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄{res}", "", ""),
        ("█               █", f"{c_box}█{c_bg}               {res}{c_box}█{res}", "Announcements", f"{c_title}Announcements{res}"),
        ("█  cc       ■   █", f"{c_box}█{c_bg}  {c_box}\033[1mcc{res}{c_bg}       \033[38;2;229;229;229m■{res}{c_bg}   {res}{c_box}█{res}", "Try MINI-CC", "Try MINI-CC"),
        ("█               █", f"{c_box}█{c_bg}               {res}{c_box}█{res}", "Website: https://mini-cc.raingpt.top/", f"Website: {c_blue}https://mini-cc.raingpt.top/{res}"),
        ("▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀", f"{c_box}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀{res}", "Github: https://github.com/you-want/mini-cc", f"Github: {c_blue}https://github.com/you-want/mini-cc{res}"),
        ("", "", "", ""),
        (f"Welcome back, {u_disp}", f"Welcome back, {c_cyan}{u_disp}{res}", "────────────────────────────────────────", f"{c_gray}────────────────────────────────────────{res}"),
        (f"Model: {m_disp}", f"Model: {c_cyan}{m_disp}{res}", "Did you know?", f"{c_title}Did you know?{res}"),
        (f"Provider: {provider_display}", f"Provider: {c_cyan}{provider_display}{res}", "You can use /buddy to summon a digital pet!", f"You can use {c_yellow}/buddy{res} to summon a digital pet!"),
        (f"{c_disp}", f"{c_gray}{c_disp}{res}", "Type /clear to clear context history.", f"Type {c_yellow}/clear{res} to clear context history.")
    ]
    
    print(f'{c_box}╭────────────────────────────────────────────────────────────────────────────────────╮{res}')
    for raw_l, col_l, raw_r, col_r in lines:
        pad_l = 39 - len(raw_l)
        pad_r = 43 - len(raw_r)
        print(f'{c_box}│{res} {col_l}{" " * max(0, pad_l)}{col_r}{" " * max(0, pad_r)} {c_box}│{res}')
    print(f'{c_box}╰────────────────────────────────────────────────────────────────────────────────────╯{res}\n')

    # 进入主交互循环 (REPL)
    while True:
        try:
            # 接收用户输入
            user_input = input('\033[36mmini-cc> \033[0m').strip()
            
            # 忽略空输入
            if not user_input:
                continue
                
            # 处理退出命令
            if user_input.lower() in ['exit', 'quit', '/exit']:
                print('\033[32m再见！\033[0m')
                break
                
            # 处理帮助命令
            if user_input.lower() == '/help':
                print('\033[36m\n=== 可用命令 ===\033[0m')
                print('\033[90m  /help     - 显示此帮助信息\033[0m')
                print('\033[90m  /clear    - 清空当前对话历史\033[0m')
                print('\033[90m  /buddy    - 召唤电子宠物彩蛋\033[0m')
                print('\033[90m  exit/quit - 退出程序\033[0m')
                print('\033[36m==============\n\033[0m')
                continue
                
            # 处理彩蛋命令 (电子宠物)
            if user_input.lower() == '/buddy':
                spawn_buddy()
                continue
                
            # 处理清空上下文命令
            # 做法是重新实例化 Provider 和 Agent，丢弃旧的历史记录
            if user_input.lower() == '/clear':
                if provider_name == 'openai':
                    provider_instance = OpenAIProvider(api_key, base_url, model_name)
                elif provider_name == 'anthropic':
                    provider_instance = AnthropicProvider(api_key, model_name)
                agent = Agent(provider_instance)
                print('\033[32m✓ 对话历史已清空。\033[0m')
                continue

            print('\033[2m\n[Agent] 已收到指令，正在思考中...\n\033[0m')
            
            # 定义回调函数，用于在终端实时打印模型返回的流式文本
            def on_text_response(text: str, is_thinking: bool = False):
                if is_thinking:
                    # 思考过程的输出使用灰色
                    sys.stdout.write(f'\033[2m{text}\033[0m')
                else:
                    # 正常回复使用绿色
                    sys.stdout.write(f'\033[32m{text}\033[0m')
                sys.stdout.flush()

            # 将用户输入交给 Agent 处理
            try:
                await agent.chat(user_input, on_text_response)
                print()
            except KeyboardInterrupt:
                # 在大模型生成或工具执行期间捕获 Ctrl+C，只打断当前任务，不退出整个程序
                print('\033[33m\n[打断] 当前操作已被用户终止 (Ctrl+C)。\033[0m')
            except Exception as e:
                print(f'\033[31m\n[任务异常] {str(e)}\n\033[0m')
                
        except KeyboardInterrupt:
            # 捕获在 input() 等待输入时的 Ctrl+C 中断，此时退出程序
            print('\033[32m\n再见！\033[0m')
            break
        except asyncio.CancelledError:
            # 捕获由于 Ctrl+C 导致的协程取消异常，直接退出
            print('\033[32m\n再见！\033[0m')
            break
        except EOFError:
            # 捕获 Ctrl+D 结束符
            print('\033[32m\n再见！\033[0m')
            break
        except Exception as e:
            # 捕获并打印其他未知异常
            print(f'\033[31m\n[系统错误] {str(e)}\n\033[0m')

if __name__ == '__main__':
    # 运行异步主函数
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass

def run_cli():
    """供 pip 安装后作为全局命令入口调用"""
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass