import os
import sys
import asyncio
from dotenv import load_load
import colorama

# Ensure src path is accessible
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.agent import Agent
from src.core.providers.openai_provider import OpenAIProvider

async def main():
    colorama.init()
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    args = sys.argv[1:]
    if len(args) == 1 and args[0] in ['--version', '-v']:
        print('mini-cc python v1.0.0 (Fast-path)')
        sys.exit(0)

    provider_name = os.environ.get('PROVIDER', 'openai').lower()
    
    if provider_name == 'openai':
        api_key = os.environ.get('OPENAI_API_KEY', '')
        base_url = os.environ.get('OPENAI_BASE_URL')
        model_name = os.environ.get('MODEL_NAME', 'qwen3.6-plus')

        if not api_key:
            print('\033[31m错误：未设置 OPENAI_API_KEY 环境变量。\033[0m')
            sys.exit(1)
            
        print(f'\033[90m[系统配置] 已选择 OpenAI 兼容模型，模型名称: {model_name}\033[0m')
        provider_instance = OpenAIProvider(api_key, base_url, model_name)
    else:
        print('\033[31mPython 版本目前仅支持 OpenAI 兼容接口。\033[0m')
        sys.exit(1)

    agent = Agent(provider_instance)

    print('\033[1;34m\n=== 欢迎使用 mini-cc (Python) ===\n\033[0m')
    print('\033[90m输入您的需求，我将为您编写代码或执行系统操作。\033[0m')
    print('\033[90m键入 "exit" 或 "quit" 退出程序。\n\033[0m')

    while True:
        try:
            user_input = input('\033[36mmini-cc> \033[0m').strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['exit', 'quit']:
                print('\033[32m再见！\033[0m')
                break
                
            if user_input.lower() == '/help':
                print('\033[36m\n=== 可用命令 ===\033[0m')
                print('\033[90m  /help     - 显示此帮助信息\033[0m')
                print('\033[90m  /clear    - 清空当前对话历史\033[0m')
                print('\033[90m  exit/quit - 退出程序\033[0m')
                print('\033[36m==============\n\033[0m')
                continue
                
            if user_input.lower() == '/clear':
                provider_instance = OpenAIProvider(api_key, base_url, model_name)
                agent = Agent(provider_instance)
                print('\033[32m✓ 对话历史已清空。\033[0m')
                continue

            print('\033[2m\n[Agent] 已收到指令，正在思考中...\n\033[0m')
            
            def on_text_response(text: str, is_thinking: bool = False):
                if is_thinking:
                    sys.stdout.write(f'\033[2m{text}\033[0m')
                else:
                    sys.stdout.write(f'\033[32m{text}\033[0m')
                sys.stdout.flush()

            await agent.chat(user_input, on_text_response)
            print()
            
        except KeyboardInterrupt:
            print('\033[32m\n再见！\033[0m')
            break
        except EOFError:
            print('\033[32m\n再见！\033[0m')
            break
        except Exception as e:
            print(f'\033[31m\n[系统错误] {str(e)}\n\033[0m')

if __name__ == '__main__':
    asyncio.run(main())