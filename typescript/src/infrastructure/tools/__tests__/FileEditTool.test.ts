import { fileEditTool } from '../FileEditTool';
import { ToolUseContext } from '../Tool';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileEditTool', () => {
  let testDir: string;
  let testFile: string;
  let context: ToolUseContext;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-test-'));
    testFile = path.join(testDir, 'test.ts');
    
    await fs.writeFile(
      testFile,
      'function add(a, b) {\n  return a + b;\n}\n\nconst x = 10;\n'
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

  test('应该成功替换文本', async () => {
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: 'return a + b;',
        new_string: 'return a + b + 1;',
      },
      context
    );
    
    expect(result.success).toBe(true);
    expect(result.replacements).toBe(1);
    
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('return a + b + 1;');
  });

  test('应该提供编辑预览', async () => {
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: 'const x = 10;',
        new_string: 'const x = 20;',
      },
      context
    );
    
    expect(result.preview).toBeDefined();
    expect(result.preview?.before).toContain('10');
    expect(result.preview?.after).toContain('20');
  });

  test('应该支持 replace_all 选项', async () => {
    await fs.writeFile(
      testFile,
      'const x = 10;\nconst y = 10;\nconst z = 10;\n'
    );
    
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: '10',
        new_string: '20',
        replace_all: true,
      },
      context
    );
    
    expect(result.success).toBe(true);
    expect(result.replacements).toBe(3);
    
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).not.toContain('10');
    expect(content.match(/20/g)?.length).toBe(3);
  });

  test('应该拒绝多个匹配但未设置 replace_all', async () => {
    await fs.writeFile(
      testFile,
      'const x = 10;\nconst y = 10;\n'
    );
    
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: '10',
        new_string: '20',
      },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('找到 2 处匹配');
  });

  test('应该处理文件不存在的情况', async () => {
    const result = await fileEditTool.execute(
      {
        file_path: 'nonexistent.ts',
        old_string: 'old',
        new_string: 'new',
      },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('文件不存在');
  });

  test('应该处理未找到 old_string 的情况', async () => {
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: 'nonexistent text',
        new_string: 'new text',
      },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('未找到要替换的内容');
  });

  test('应该拒绝相同的 old_string 和 new_string', async () => {
    const result = await fileEditTool.execute(
      {
        file_path: 'test.ts',
        old_string: 'const x = 10;',
        new_string: 'const x = 10;',
      },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('相同');
  });
});
