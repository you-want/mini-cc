import os

async def execute_file_write(args: dict) -> str:
    file_path = args.get("file_path")
    content = args.get("content")
    
    if not file_path:
        return "写入文件时出错：file_path 不能为空"
    
    print(f"[FileWriteTool] 正在写入文件: {file_path}")
    
    try:
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return f"文件写入成功：{file_path}"
    except Exception as e:
        return f"写入文件时出错：{str(e)}"

file_write_tool = {
    "name": "FileWriteTool",
    "description": """
    将内容写入到指定文件。
    注意：
    - 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。
    - 如果目录不存在，系统会自动为你递归创建所需的父目录，因此你完全不需要提前调用 BashTool 执行 mkdir 命令。
    - 始终使用绝对路径。
    """,
    "inputSchema": {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "目标文件的绝对路径",
            },
            "content": {
                "type": "string",
                "description": "要写入的完整文件内容",
            },
        },
        "required": ["file_path", "content"],
    },
    "execute": execute_file_write
}