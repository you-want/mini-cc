#!/usr/bin/env node

/**
 * 简化版自测脚本（不包含网络请求）
 */

import { todoWriteTool } from '../TodoWriteTool';
import { taskCreateTool } from '../TaskCreateTool';
import { taskListTool } from '../TaskListTool';
import { lspTool } from '../LSPTool';
import { notebookEditTool } from '../NotebookEditTool';
import { createAppStateStore } from '../../state/AppStateStore';
import type { ToolUseContext } from '../Tool';
import * as fs from 'fs/promises';
import * as path from 'path';

// 创建模拟的状态管理器
const mockStateStore = createAppStateStore({
  settings: {
    verbose: true,
    mainLoopModel: 'openai',
  },
  tasks: {},
  toolPermissionContext: {
    strategy: 'auto' as const,
    allowedTools: new Set(),
    deniedTools: new Set(),
  },
  activeSkill: null,
});

// 创建模拟的工具上下文
const mockContext: ToolUseContext = {
  stateStore: mockStateStore,
  permissionContext: {
    strategy: 'auto',
    allowedTools: new Set(),
    deniedTools: new Set(),
  },
  workspaceDir: process.cwd(),
};

async function runTests() {
  console.log('🧪 开始测试新工具...\n');
  
  let passed = 0;
  let failed = 0;

  // 测试 1: TodoWriteTool
  console.log('📝 测试 1: TodoWriteTool');
  try {
    const result = await todoWriteTool.execute(
      {
        todos: [
          {
            content: '实现用户登录功能',
            status: 'in_progress',
            activeForm: '正在实现用户登录功能',
          },
          {
            content: '编写单元测试',
            status: 'pending',
            activeForm: '编写单元测试',
          },
        ],
      },
      mockContext
    );
    console.log('✅ TodoWriteTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   任务数量: ${result.newTodos.length}\n`);
    passed++;
  } catch (error: any) {
    console.error(`❌ TodoWriteTool 测试失败: ${error.message}\n`);
    failed++;
  }

  // 测试 2: TaskCreateTool
  console.log('📋 测试 2: TaskCreateTool');
  try {
    const result = await taskCreateTool.execute(
      {
        subject: '测试任务',
        description: '这是一个测试任务的描述',
      },
      mockContext
    );
    console.log('✅ TaskCreateTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   任务ID: ${result.task.id}\n`);
    passed++;
  } catch (error: any) {
    console.error(`❌ TaskCreateTool 测试失败: ${error.message}\n`);
    failed++;
  }

  // 测试 3: TaskListTool
  console.log('📊 测试 3: TaskListTool');
  try {
    const result = await taskListTool.execute({}, mockContext);
    console.log('✅ TaskListTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   任务数量: ${result.tasks.length}\n`);
    passed++;
  } catch (error: any) {
    console.error(`❌ TaskListTool 测试失败: ${error.message}\n`);
    failed++;
  }

  // 测试 4: LSPTool - getSymbols
  console.log('💻 测试 4: LSPTool (getSymbols)');
  try {
    const testFilePath = path.join(process.cwd(), 'src/infrastructure/tools/index.ts');
    const result = await lspTool.execute(
      {
        operation: 'getSymbols',
        filePath: testFilePath,
      },
      mockContext
    );
    console.log('✅ LSPTool getSymbols 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   符号数量: ${result.count}\n`);
    passed++;
  } catch (error: any) {
    console.log(`⚠️  LSPTool 测试: ${error.message}\n`);
    failed++;
  }

  // 测试 5: NotebookEditTool
  console.log('📓 测试 5: NotebookEditTool');
  try {
    const testNotebookPath = '/tmp/test_mini_cc_notebook.ipynb';
    
    // 创建测试 notebook
    await fs.writeFile(
      testNotebookPath,
      JSON.stringify({
        cells: [],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      }),
      'utf-8'
    );

    // 测试添加单元格
    const addResult = await notebookEditTool.execute(
      {
        filePath: testNotebookPath,
        operation: 'add',
        cellType: 'code',
        content: 'print("Hello, World!")',
      },
      mockContext
    );
    console.log('✅ NotebookEditTool add 测试通过');
    console.log(`   消息: ${addResult.message}\n`);

    // 测试读取
    const readResult = await notebookEditTool.execute(
      {
        filePath: testNotebookPath,
        operation: 'read',
      },
      mockContext
    );
    console.log('✅ NotebookEditTool read 测试通过');
    console.log(`   消息: ${readResult.message}`);
    console.log(`   单元格数量: ${readResult.cellCount}\n`);

    // 清理测试文件
    await fs.unlink(testNotebookPath);
    passed += 2; // 两个操作都成功
  } catch (error: any) {
    console.error(`❌ NotebookEditTool 测试失败: ${error.message}\n`);
    failed++;
  }

  // 总结
  console.log('='.repeat(50));
  console.log(`🎉 测试完成！`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${passed + failed}`);
  console.log('='.repeat(50));
}

runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
