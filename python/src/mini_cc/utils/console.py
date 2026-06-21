"""
终端控制台 (console.py)
=====================

基于 rich 库的终端输出工具，提供统一的日志和消息格式。
"""

from rich.console import Console
from rich.theme import Theme
from rich.panel import Panel

# 自定义主题，用于控制不同类型消息的颜色和样式
custom_theme = Theme({
    "info": "dim cyan",       # 提示信息：淡青色
    "warning": "yellow",      # 警告信息：黄色
    "error": "bold red",      # 错误信息：加粗红色
    "success": "bold green",  # 成功信息：加粗绿色
    "ai": "blue",             # AI 的回复：蓝色
    "user": "bold white",     # 用户输入：加粗白色
    "tool": "magenta",        # 工具调用：洋红色
})

# 全局的 Console 实例
console = Console(theme=custom_theme)


def print_welcome() -> None:
    """打印欢迎信息"""
    welcome_text = """[bold cyan]mini-cc[/bold cyan] - AI 编程助手 (Python 版)

[dim]命令:[/dim]
  [bold yellow]/help[/bold yellow]   查看帮助
  [bold yellow]/clear[/bold yellow]  清空对话历史
  [bold yellow]/buddy[/bold yellow]  召唤电子宠物
  [bold red]/exit[/bold red]    退出应用"""
    
    console.print(Panel(welcome_text, title="Welcome", border_style="cyan"))
    console.print()
