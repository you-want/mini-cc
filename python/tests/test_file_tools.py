import pytest
import os
import shutil
from src.tools.file_read_tool import execute_file_read
from src.tools.file_write_tool import execute_file_write

@pytest.fixture
def temp_workspace(tmp_path):
    os.chdir(tmp_path)
    yield tmp_path

@pytest.mark.asyncio
async def test_file_write_and_read(temp_workspace):
    # Test Write
    test_file = "test_dir/test_file.txt"
    content = "Hello Mini-CC!"
    res_write = await execute_file_write({"file_path": test_file, "content": content})
    assert "成功" in res_write
    assert os.path.exists(test_file)
    
    # Test Read
    res_read = await execute_file_read({"file_path": test_file})
    assert "Hello Mini-CC!" in res_read

@pytest.mark.asyncio
async def test_file_read_truncate(temp_workspace):
    test_file = "long_file.txt"
    content = "\n".join([f"Line {i}" for i in range(1200)])
    with open(test_file, "w") as f:
        f.write(content)
        
    res_read = await execute_file_read({"file_path": test_file})
    assert "Line 999" in res_read
    assert "Line 1000" not in res_read
    assert "截断" in res_read
