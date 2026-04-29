import pytest
from src.agent.memory import MemoryManager

def test_memory_manager(tmp_path):
    # 使用 pytest 的 tmp_path 提供一个隔离的测试目录
    manager = MemoryManager(workspace_dir=str(tmp_path))
    
    # 测试目录和基础文件是否生成
    assert manager.memory_dir.exists()
    assert manager.global_memory_file.exists()
    
    # 测试获取默认内容
    content = manager.get_global_memory()
    assert "系统全局记忆" in content
    
    # 测试追加记忆
    manager.add_memory("测试约定：永远使用 4 个空格缩进。")
    content = manager.get_global_memory()
    assert "测试约定：永远使用 4 个空格缩进。" in content
    
    # 测试防爆截断机制 (塞入超过 5000 字符的垃圾内容)
    junk = "a" * 6000
    manager.add_memory(junk)
    content = manager.get_global_memory()
    
    assert len(content) <= 5000 + 50 # 截断字符串 + 提示语
    assert "(记忆过长被截断)" in content
