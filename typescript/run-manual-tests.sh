#!/bin/bash

# Mini-CC 新工具快速测试脚本
# 这个脚本会自动准备测试环境并运行基本测试

set -e  # 遇到错误时退出

echo "🚀 Mini-CC 新工具快速测试"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在 mini-cc/typescript 目录下运行此脚本${NC}"
    exit 1
fi

echo "📋 步骤 1: 检查编译状态"
echo "--------------------------------"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 编译成功${NC}"
else
    echo -e "${RED}❌ 编译失败，请先修复编译错误${NC}"
    exit 1
fi
echo ""

echo "📋 步骤 2: 准备测试文件"
echo "--------------------------------"

# 创建测试 Notebook
echo "创建测试 Notebook..."
cat > /tmp/test_manual_notebook.ipynb << 'EOF'
{
  "cells": [],
  "metadata": {},
  "nbformat": 4,
  "nbformat_minor": 5
}
EOF
echo -e "${GREEN}✅ Notebook 文件已创建: /tmp/test_manual_notebook.ipynb${NC}"

# 创建测试 TypeScript 文件
echo "创建测试 TypeScript 文件..."
cat > /tmp/test_manual_lsp.ts << 'EOF'
// 测试 LSP 工具的文件

function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

class UserService {
  private users: string[] = [];
  
  getUsers(): string[] {
    return this.users;
  }
  
  addUser(name: string): void {
    this.users.push(name);
  }
}

interface Config {
  apiUrl: string;
  timeout: number;
}

const MAX_RETRY = 3;
const DEFAULT_TIMEOUT = 5000;

export { calculateTotal, UserService, Config, MAX_RETRY };
EOF
echo -e "${GREEN}✅ TypeScript 文件已创建: /tmp/test_manual_lsp.ts${NC}"
echo ""

echo "📋 步骤 3: 运行自动化测试"
echo "--------------------------------"
npx ts-node src/infrastructure/tools/__tests__/test-tools-simple.ts
echo ""

echo "📋 步骤 4: 手动测试准备完成"
echo "================================"
echo ""
echo -e "${YELLOW}现在可以开始手动测试了！${NC}"
echo ""
echo "启动 mini-cc:"
echo "  npm dev    # 开发模式（推荐）"
echo "  npm start  # 生产模式"
echo ""
echo "测试文件位置:"
echo "  📓 Notebook: /tmp/test_manual_notebook.ipynb"
echo "  💻 TypeScript: /tmp/test_manual_lsp.ts"
echo ""
echo "参考测试指南:"
echo "  📖 MANUAL_TEST_GUIDE.md"
echo ""
echo -e "${GREEN}祝测试顺利！🎉${NC}"
