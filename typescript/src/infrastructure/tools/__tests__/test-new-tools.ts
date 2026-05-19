#!/usr/bin/env node

/**
 * 新工具自测脚本
 * 测试所有新实现的工具功能
 */

import { todoWriteTool } from '../TodoWriteTool';
import { taskCreateTool } from '../TaskCreateTool';
import { taskListTool } from '../TaskListTool';
import { webSearchTool } from '../WebSearchTool';
import { lspTool } from '../LSPTool';
import { notebookEditTool } from '../NotebookEditTool';
import { createAppStateStore } from '../../state/AppStateStore';
import type { ToolUseContext } from '../Tool';

// 创建模拟的状态管理器
const mockStateStore = createAppStateStore({
  settings: {
    verbose: true,
    mainLoopModel: 'openai',
  },
  tasks: {},
  toolPermissionContext: {},
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
  } catch (error: any) {
    console.error(`❌ TodoWriteTool 测试失败: ${error.message}\n`);
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
  } catch (error: any) {
    console.error(`❌ TaskCreateTool 测试失败: ${error.message}\n`);
  }

  // 测试 3: TaskListTool
  console.log('📊 测试 3: TaskListTool');
  try {
    const result = await taskListTool.execute({}, mockContext);
    console.log('✅ TaskListTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   任务数量: ${result.tasks.length}\n`);
  } catch (error: any) {
    console.error(`❌ TaskListTool 测试失败: ${error.message}\n`);
  }

  // 测试 4: WebSearchTool（需要网络，可能失败）
  console.log('🔍 测试 4: WebSearchTool');
  try {
    const result = await webSearchTool.execute(
      {
        query: 'TypeScript tutorial',
        num_results: 3,
      },
      mockContext
    );
    console.log('✅ WebSearchTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   结果数量: ${result.count}\n`);
  } catch (error: any) {
    console.log(`⚠️  WebSearchTool 测试（网络依赖，可能失败）: ${error.message}\n`);
  }

  // 测试 5: LSPTool - getSymbols
  console.log('💻 测试 5: LSPTool (getSymbols)');
  try {
    const result = await lspTool.execute(
      {
        operation: 'getSymbols',
        filePath: './index.ts',
      },
      mockContext
    );
    console.log('✅ LSPTool getSymbols 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   符号数量: ${result.count}\n`);
  } catch (error: any) {
    console.log(`⚠️  LSPTool 测试（文件可能不存在）: ${error.message}\n`);
  }

  // 测试 6: NotebookEditTool - 需要先创建一个测试文件
  console.log('📓 测试 6: NotebookEditTool');
  try {
    // 先创建一个简单的测试 notebook
    const testNotebookPath = '/tmp/test_notebook.ipynb';
    const fs = await import('fs/promises');
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

    const result = await notebookEditTool.execute(
      {
        filePath: testNotebookPath,
        operation: 'add',
        cellType: 'code',
        content: 'print("Hello, World!")',
      },
      mockContext
    );
    console.log('✅ NotebookEditTool 测试通过');
    console.log(`   消息: ${result.message}`);
    console.log(`   单元格数量: ${result.cellCount}\n`);

    // 清理测试文件
    await fs.unlink(testNotebookPath);
  } catch (error: any) {
    console.error(`❌ NotebookEditTool 测试失败: ${error.message}\n`);
  }

  console.log('🎉 所有测试完成！');
}

runTests().catch(console.error);
