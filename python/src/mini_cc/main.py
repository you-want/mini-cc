"""
mini-cc Python 版入口文件

这是我们 AI 编程助手的起点。随着学习的深入，我们会不断完善这个文件。
"""

def main():
    """主函数 - 程序入口"""
    print("Welcome to mini-cc Python!")
    print("Let's build an AI coding assistant together.")
    
    # 简单的交互式对话（第1章练习：接收用户输入并打招呼）
    user_name = input("\nWhat's your name? ").strip()
    if user_name:
        print(f"Hello, {user_name}! Let's start our AI journey.")
    else:
        print("Hello, Guest! Let's start our AI journey.")

if __name__ == "__main__":
    """
    这个条件判断的意思是：
    - 如果直接运行这个文件，就执行 main()
    - 如果被别的文件导入，就不自动执行
    
    类似 JS 里的 if (require.main === module)
    """
    main()

def run_cli():
    """供 pip 安装后作为全局命令入口调用"""
    main()
