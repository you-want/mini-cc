import re

def is_destructive_command(command: str) -> bool:
    """
    检查是否是高危破坏性命令。
    大模型有时候会"产生幻觉"或者被恶意提示诱导，去执行 rm -rf / 之类的命令。
    我们在它真正丢给系统执行前，进行最后一道静态正则拦截。
    """
    # 将多个命令拆分（支持 ; 和 && 和 || 拼接的复合命令）
    parts = re.split(r';|&&|\|\|', command)
    
    for part in parts:
        cmd = part.strip()
        if not cmd:
            continue
            
        # 1. 拦截 rm -rf / 或 rm -rf /*
        # 使用正则匹配各种变体，例如 rm -fr /, rm -r -f /, sudo rm -rf /
        if re.search(r'\brm\s+(?:-[A-Za-z]*r[A-Za-z]*\s+-[A-Za-z]*f[A-Za-z]*|-[A-Za-z]*f[A-Za-z]*\s+-[A-Za-z]*r[A-Za-z]*|-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*|-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*)\s+/\*?(?:\s|$)', cmd):
            return True
            
        # 2. 拦截清空磁盘/格式化操作 (mkfs, dd if=/dev/zero of=/dev/sda)
        if re.search(r'\bmkfs\b', cmd):
            return True
        if re.search(r'\bdd\s+if=/dev/(?:zero|urandom)\s+of=/dev/[a-z]+', cmd):
            return True
            
        # 3. 拦截 fork 炸弹 (:(){ :|:& };:)
        # 这是 Linux 下著名的让系统资源耗尽的恶意命令
        if ":(){" in cmd.replace(" ", ""):
            return True
            
        # 4. 拦截对敏感系统配置的覆写
        if re.search(r'>\s*/etc/(?:passwd|shadow|fstab|sudoers)', cmd):
            return True
            
    return False
