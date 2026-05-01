import pytest
import os
import shutil
from src.tools.file_read import FileReadTool
from src.tools.file_write import FileWriteTool

@pytest.fixture
def temp_workspace(tmp_path):
    os.chdir(tmp_path)
    # mock test_file dir for the new BaseTool path logic
    test_file_dir = tmp_path.parent / "test_file"
    test_file_dir.mkdir(parents=True, exist_ok=True)
    yield tmp_path

@pytest.mark.asyncio
async def test_file_write_and_read(temp_workspace):
    # Test Write
    test_file = str(temp_workspace.parent / "test_file" / "test_dir/test_file.txt")
    content = "Hello Mini-CC!"
    writer = FileWriteTool()
    res_write = await writer.execute(file_path=test_file, content=content)
    assert "成功" in res_write
    assert os.path.exists(test_file)
    
    # Test Read
    reader = FileReadTool()
    res_read = await reader.execute(file_path=test_file)
    assert "Hello Mini-CC!" in res_read

@pytest.mark.asyncio
async def test_file_read_truncate(temp_workspace):
    test_file = str(temp_workspace.parent / "test_file" / "long_file.txt")
    content = "\n".join([f"Line {i}" for i in range(1200)])
    os.makedirs(os.path.dirname(test_file), exist_ok=True)
    with open(test_file, "w") as f:
        f.write(content)
        
    reader = FileReadTool()
    res_read = await reader.execute(file_path=test_file, limit=1000)
    assert "Line 999" in res_read
    assert "Line 1000" not in res_read
    assert "截断" in res_read or "第 1 到 1000 行" in res_read
