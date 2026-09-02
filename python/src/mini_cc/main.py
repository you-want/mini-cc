"""
mini-cc-py Python 版入口文件

这是 AI 编程助手的起点。
委托给 cli.main 模块实现完整的 CLI 功能。
"""

from mini_cc.cli.main import run_cli as _run_cli


def main():
    """主函数 - 程序入口（委托给 CLI）"""
    _run_cli()


def run_cli():
    """供 pip 安装后作为全局命令入口调用"""
    _run_cli()


if __name__ == "__main__":
    main()
