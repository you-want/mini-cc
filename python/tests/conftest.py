import sys
import os

# 将项目根目录添加到 Python 路径中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
# 将 src 目录添加到 Python 路径中，兼容测试对 src 下模块（如 agent.memory）的导入
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
