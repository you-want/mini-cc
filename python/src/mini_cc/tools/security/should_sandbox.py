# 在 Python 中，我们定义好允许绕过沙盒直接在宿主机执行的命令白名单
SAFE_COMMANDS = {
    "ls", "cat", "echo", "pwd", "whoami", "uname", "date", "cd",
    "grep", "find", "wc", "head", "tail", "less", "more", "sort", "uniq",
    "git", "node", "npm", "yarn", "pnpm", "python", "python3", "pip", "pytest",
    "rustc", "cargo", "go", "java", "javac", "mvn", "gradle",
    "which", "type", "whereis", "stat"
}

# 常见的命令包装器（它们本身不是命令，而是用来修饰命令的）
# 比如：timeout 10 ls -> 核心命令其实是 ls
WRAPPERS = {
    "timeout", "sudo", "watch", "nohup", "time", "env", "xargs", "stdbuf", "nice"
}

def strip_wrappers(cmd: str) -> str:
    """
    剥离命令包装器，提取出最核心的真实命令。
    例如将 'sudo -u root timeout -s SIGKILL 10 ls -la' 剥离为 'ls -la'。
    
    这是判断一个命令是否属于“安全白名单”的重要前置步骤，
    防止大模型用 timeout 包装一个安全命令，却被我们误判为危险命令。
    """
    parts = cmd.split()
    if not parts:
        return cmd
        
    while parts:
        first_word = parts[0]
        # 如果第一个词是包装器，我们需要把它剥离掉
        if first_word in WRAPPERS:
            parts.pop(0) # 移除包装器名字
            
            # 继续剥离紧跟其后的选项（比如 -u root 或者 --signal=9，或者单纯的数字如 10）
            # 注意：在 Python 版本的实现中，我们需要跳过带 - 的选项和它的参数，以及纯数字
            while parts:
                if parts[0].startswith('-'):
                    parts.pop(0) # 移除选项
                    # 如果下一个词不以 - 开头且不是命令，可能是这个选项的参数 (如 root)
                    if parts and not parts[0].startswith('-') and parts[0] not in SAFE_COMMANDS and parts[0] not in WRAPPERS:
                         parts.pop(0)
                elif parts[0].isdigit():
                    parts.pop(0)
                else:
                    break
                
            # 如果剥完一圈，发现下一个词还是包装器（比如 sudo timeout ls），那就继续 while 循环
            continue
            
        # 也有可能是环境变量赋值，比如 ENV_VAR=1 ls
        if '=' in first_word and not first_word.startswith('-'):
            parts.pop(0)
            continue
            
        # 如果既不是包装器，也不是环境变量赋值，那我们就认为找到了核心命令
        break
        
    return " ".join(parts) if parts else cmd

def should_use_sandbox(command: str) -> bool:
    """
    判断一个命令是否需要放入安全沙盒（Docker 容器）中执行。
    
    策略：
    如果剥离包装器后的核心命令在 SAFE_COMMANDS 白名单中，
    则认为它是开发工具链或基础查询命令，允许在宿主机直接执行（返回 False）。
    否则，返回 True，表示需要放入沙盒隔离。
    """
    # 拆分复合命令（由分号、管道符或逻辑操作符连接）
    import re
    # 这里用正则拆分，注意管道符 | 也算拆分点
    parts = re.split(r';|&&|\|\||\|', command)
    
    for part in parts:
        cmd = part.strip()
        if not cmd:
            continue
            
        stripped_cmd = strip_wrappers(cmd)
        
        # 取剥离后的第一个词作为核心执行命令
        words = stripped_cmd.split()
        if not words:
            continue
            
        base_cmd = words[0]
        
        # 只要拆分后的任意一段命令不在白名单里，整个复合命令都要丢进沙盒！
        if base_cmd not in SAFE_COMMANDS:
            return True
            
    return False
