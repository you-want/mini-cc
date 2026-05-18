import { grepTool } from '../GrepTool';
import { ToolUseContext } from '../Tool';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('GrepTool', () => {
  let testDir: string;
  let context: ToolUseContext;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grep-test-'));
    
    await fs.writeFile(
      path.join(testDir, 'file1.ts'),
      'function hello() {\n  console.log("Hello");\n}\n'
    );
    await fs.writeFile(
      path.join(testDir, 'file2.ts'),
      'const TODO = "fix this";\nfunction world() {\n  return "World";\n}\n'
    );
    await fs.writeFile(
      path.join(testDir, 'file3.js'),
      'import React from "react";\nexport default App;\n'
    );
    
    context = {
      stateStore: {} as any,
      permissionContext: {} as any,
      workspaceDir: testDir,
    };
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('应该找到匹配的文本', async () => {
    const result = await grepTool.execute({ pattern: 'function' }, context);
    
    expect(result.totalMatches).toBeGreaterThanOrEqual(2);
    expect(result.matches.some(m => m.content.includes('hello'))).toBe(true);
    expect(result.matches.some(m => m.content.includes('world'))).toBe(true);
  });

  test('应该支持正则表达式', async () => {
    const result = await grepTool.execute(
      { pattern: 'function\\s+\\w+' },
      context
    );
    
    expect(result.totalMatches).toBeGreaterThanOrEqual(2);
  });

  test('应该支持大小写敏感搜索', async () => {
    const result = await grepTool.execute(
      { pattern: 'TODO', caseSensitive: true },
      context
    );
    
    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].content).toContain('TODO');
  });

  test('应该支持文件类型过滤', async () => {
    const result = await grepTool.execute(
      { pattern: 'import', filePattern: '*.js' },
      context
    );
    
    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].file).toContain('.js');
  });

  test('应该返回行号', async () => {
    const result = await grepTool.execute({ pattern: 'TODO' }, context);
    
    expect(result.matches[0].line).toBe(1);
  });

  test('应该支持上下文行', async () => {
    const result = await grepTool.execute(
      { pattern: 'TODO', contextLines: 1 },
      context
    );
    
    expect(result.matches[0].context).toBeDefined();
    expect(result.matches[0].context?.after).toBeDefined();
  });

  test('应该处理无效的正则表达式', async () => {
    await expect(
      grepTool.execute({ pattern: '[invalid' }, context)
    ).rejects.toThrow('无效的正则表达式');
  });

  test('应该返回空结果当没有匹配时', async () => {
    const result = await grepTool.execute(
      { pattern: 'nonexistent_pattern_xyz' },
      context
    );
    
    expect(result.totalMatches).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
