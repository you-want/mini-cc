import sys
import asyncio
import argparse

# 确保能导入 src 目录下的模块
# 这在 Python 开发中是个常见做法，把当前工作目录加入搜索路径
sys.path.insert(0, ".")

from src.config import check_first_run_setup, set_config_value, get_config_value
from src.utils.console import console
from src.agent.loop import main_loop

def handle_cli_args():
    """处理命令行参数 (CLI)"""
    # argparse 是 Python 标准库中处理命令行的利器
    parser = argparse.ArgumentParser(
        description="mini-cc: 一个轻量级的 AI 编程 Agent (Python 版本)"
    )
    
    # 定义命令行版本号和帮助
    parser.add_argument("-v", "--version", action="version", version="mini-cc (Python) 0.1.0")
    
    # 模拟 TS 版本中的 `mini-cc config set KEY=VALUE` 命令
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    config_parser = subparsers.add_parser("config", help="管理全局配置")
    config_subparsers = config_parser.add_subparsers(dest="config_action")
    
    # config set
    set_parser = config_subparsers.add_parser("set", help="设置配置项")
    set_parser.add_argument("key_value", nargs="+", help="格式: KEY=VALUE 或 KEY VALUE")
    
    # config get
    get_parser = config_subparsers.add_parser("get", help="获取配置项")
    get_parser.add_argument("key", help="配置项键名")
    
    args = parser.parse_args()
    
    if args.command == "config":
        if args.config_action == "set":
            kv = " ".join(args.key_value)
            if "=" in kv:
                k, v = kv.split("=", 1)
            elif len(args.key_value) == 2:
                k, v = args.key_value
            else:
                console.print("[error]格式错误。请使用: mini-cc config set KEY=VALUE[/error]")
                sys.exit(1)
            
            set_config_value(k.strip(), v.strip())
            console.print(f"[success]✓ 配置已保存: {k.strip()}={v.strip()}[/success]")
            sys.exit(0)
            
        elif args.config_action == "get":
            val = get_config_value(args.key)
            print(val if val else "")
            sys.exit(0)

def main():
    """入口函数"""
    try:
        # 1. 检查命令行参数，如果有子命令(如 config)，处理完就会 exit
        handle_cli_args()
        
        # 2. 如果没有子命令，说明要启动主程序，先检查是不是首次运行（需不需要配 API Key）
        check_first_run_setup()
        
        # 3. 启动基于 asyncio 的主循环（因为我们后续的工具调用、网络请求都是异步的，性能更好）
        asyncio.run(main_loop())
        
    except KeyboardInterrupt:
        print("\nBye!")
        sys.exit(0)

# 经典的 Python 入口判断，如果这个文件被直接执行，才调用 main()
if __name__ == "__main__":
    main()
