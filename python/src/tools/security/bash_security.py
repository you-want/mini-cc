import re

def check_bash_security(command: str) -> bool:
    """
    检查命令是否包含高危的子命令替换模式。
    这是防范大模型（或者恶意 Prompt 注入）通过 $(...) 或 `...` 
    绕过外层安全包装器执行任意代码的关键防御机制。
    
    返回: bool
        - True: 包含被拦截的高危模式
        - False: 安全
    """
    # 1. 匹配 $(...) 风格的命令替换
    # 允许的情况：$(pwd), $(dirname ...), $(basename ...) 
    # 因为这些通常用于获取路径，相对安全
    if re.search(r'\$\((?!\s*(?:pwd|dirname|basename))[^)]+\)', command):
        return True

    # 2. 匹配反引号 `...` 风格的命令替换
    # 同样允许 pwd, dirname, basename
    if re.search(r'`(?!\s*(?:pwd|dirname|basename))[^`]+`', command):
        return True

    # 3. 拦截高危的 Zsh 模块加载
    # 防止大模型加载高级网络模块进行数据窃取或反弹 Shell
    # 例如：zmodload zsh/net/tcp
    if "zmodload" in command:
        return True

    return False
