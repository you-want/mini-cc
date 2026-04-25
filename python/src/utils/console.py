from rich.console import Console
from rich.theme import Theme

# 自定义主题，用于控制不同类型消息的颜色和样式
# Python 的 rich 库非常强大，可以用类似 BBCode 的标签 [info]...[/info] 进行染色
custom_theme = Theme({
    "info": "dim cyan",       # 提示信息：淡青色
    "warning": "yellow",      # 警告信息：黄色
    "error": "bold red",      # 错误信息：加粗红色
    "success": "bold green",  # 成功信息：加粗绿色
    "ai": "blue",             # AI 的回复：蓝色
    "user": "bold white",     # 用户输入：加粗白色
})

# 全局的 Console 实例，用于整个项目输出日志
console = Console(theme=custom_theme)

def print_welcome():
    """打印欢迎信息"""
    console.print("[success]欢迎使用 mini-cc (Python 版本)！[/success]")
    console.print("输入你想让我做的事情，或者输入 [bold yellow]/help[/bold yellow] 查看帮助，输入 [bold red]/exit[/bold red] 退出。")
    console.print("---")
