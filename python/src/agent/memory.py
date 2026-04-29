import os
from pathlib import Path
from datetime import datetime

class MemoryManager:
    """
    记忆管理器（实现两步法则）
    .ai_memory 是我们项目中的一个隐藏目录，用于持久化存储大模型的记忆。
    防止对话历史过长导致 Token 爆炸。
    """
    def __init__(self, workspace_dir: str = "."):
        self.workspace_dir = Path(workspace_dir)
        self.memory_dir = self.workspace_dir / ".ai_memory"
        # 全局记忆文件，存放最重要的项目架构规则
        self.global_memory_file = self.memory_dir / "global_memory.txt"
        
        self._ensure_memory_dir()
        
    def _ensure_memory_dir(self):
        """确保记忆目录存在，并且生成一个基础的说明文件"""
        if not self.memory_dir.exists():
            self.memory_dir.mkdir(parents=True, exist_ok=True)
            
            # 初始化一份全局记忆
            with open(self.global_memory_file, "w", encoding="utf-8") as f:
                f.write("# [系统全局记忆]\n")
                f.write("这里记录了关于当前项目最重要的规则和约定。\n")
                f.write("大模型每次启动都会读取这些内容，请保持精简。\n")
                
    def get_global_memory(self) -> str:
        """
        读取全局记忆。
        这个内容会被注入到 System Prompt 中。
        """
        if not self.global_memory_file.exists():
            return ""
            
        with open(self.global_memory_file, "r", encoding="utf-8") as f:
            content = f.read()
            
        # 防爆截断：如果全局记忆太长（超过 5000 字符），强行截断，只保留最新的部分
        if len(content) > 5000:
            content = "...(记忆过长被截断)...\n" + content[-5000:]
            
        return content
        
    def add_memory(self, memory_text: str):
        """
        向全局记忆中追加一条新知识。
        这是让 AI 变得越来越聪明的关键：它自己把学到的东西写进文件里。
        """
        self._ensure_memory_dir()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 使用追加模式 (mode="a")
        with open(self.global_memory_file, "a", encoding="utf-8") as f:
            f.write(f"\n[{timestamp}] {memory_text}")

# 提供一个便捷的工具，让大模型可以通过函数调用自己写记忆
from pydantic import BaseModel, Field
from src.tools.base import BaseTool

class AddMemoryArgs(BaseModel):
    memory_text: str = Field(..., description="要永久记住的关于项目的重要规则或约定（精简的一两句话）。")

class AddMemoryTool(BaseTool):
    name = "AddMemoryTool"
    description = "将重要的项目规则或约定永久写入 .ai_memory 中。当你发现用户有一个特定的偏好（比如：不要用 var 声明变量，要用 let/const），请调用此工具把它记下来，这样下次启动你依然会记得。"
    args_schema = AddMemoryArgs
    
    async def execute(self, memory_text: str) -> str:
        manager = MemoryManager()
        manager.add_memory(memory_text)
        return f"记忆已成功写入 .ai_memory/global_memory.txt：{memory_text}"
