import pytest
from src.tools.security.bash_security import check_bash_security
from src.tools.security.destructive_warning import is_destructive_command
from src.tools.security.should_sandbox import strip_wrappers, should_use_sandbox

def test_check_bash_security():
    # 安全的命令替换 (应该返回 False)
    assert check_bash_security("echo $(pwd)") == False
    assert check_bash_security("cd `dirname $0`") == False
    
    # 危险的命令替换 (应该返回 True)
    assert check_bash_security("echo $(ls -la)") == True
    assert check_bash_security("echo `cat /etc/passwd`") == True
    
    # Zsh 危险模块加载 (应该返回 True)
    assert check_bash_security("zmodload zsh/net/tcp") == True

def test_destructive_command():
    # 毁灭性命令 (应该返回 True)
    assert is_destructive_command("rm -rf /") == True
    assert is_destructive_command("sudo rm -rf /*") == True
    assert is_destructive_command("rm -f -r /") == True
    assert is_destructive_command("mkfs.ext4 /dev/sda") == True
    assert is_destructive_command("dd if=/dev/zero of=/dev/sda") == True
    assert is_destructive_command(":(){ :|:& };:") == True
    assert is_destructive_command("echo 'hack' > /etc/shadow") == True
    
    # 正常的删除 (应该返回 False)
    assert is_destructive_command("rm -rf ./node_modules") == False
    assert is_destructive_command("rm test.txt") == False

def test_strip_wrappers():
    assert strip_wrappers("sudo -u root timeout 10 ls -la") == "ls -la"
    assert strip_wrappers("watch -n 1 ls") == "ls"
    assert strip_wrappers("ENV_VAR=1 time node index.js") == "node index.js"
    assert strip_wrappers("npm run build") == "npm run build"

def test_should_use_sandbox():
    # 白名单内的命令 (应该返回 False, 不进沙盒)
    assert should_use_sandbox("ls -la") == False
    assert should_use_sandbox("grep -r 'test' .") == False
    assert should_use_sandbox("sudo timeout 10 git status") == False # 剥除包装器后是 git
    
    # 复合白名单命令
    assert should_use_sandbox("cd src && ls -la") == False
    
    # 非白名单命令 (应该返回 True, 进入沙盒)
    assert should_use_sandbox("curl http://example.com") == True
    assert should_use_sandbox("wget http://example.com") == True
    assert should_use_sandbox("python script.py | awk '{print $1}'") == True # awk 不在白名单
