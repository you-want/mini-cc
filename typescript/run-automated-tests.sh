#!/bin/bash

# Mini-CC 新工具自动化测试运行脚本

set -e  # 遇到错误时退出

echo "🧪 Mini-CC 新工具自动化测试"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在 mini-cc/typescript 目录下运行此脚本${NC}"
    exit 1
fi

echo -e "${BLUE}📋 步骤 1: 编译项目${NC}"
echo "--------------------------------"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 编译成功${NC}"
else
    echo -e "${RED}❌ 编译失败${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}📋 步骤 2: 运行自动化测试${NC}"
echo "--------------------------------"
npm test -- src/infrastructure/tools/__tests__/new-tools.test.ts --verbose

TEST_RESULT=$?
echo ""

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}================================"
    echo "🎉 所有测试通过！"
    echo "================================${NC}"
    echo ""
    echo -e "${YELLOW}查看详细报告:${NC}"
    echo "  📄 AUTOMATED_TEST_REPORT.md"
    echo ""
    echo -e "${YELLOW}进行手动测试:${NC}"
    echo "  📖 MANUAL_TEST_GUIDE.md"
    echo "  ⚡ ./run-manual-tests.sh"
    echo ""
else
    echo -e "${RED}================================"
    echo "❌ 测试失败，请检查错误信息"
    echo "================================${NC}"
    exit 1
fi
