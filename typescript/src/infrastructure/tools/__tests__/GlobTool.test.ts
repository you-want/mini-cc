import { globTool } from '../GlobTool';
import { ToolUseContext } from '../Tool';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('GlobTool', () => {
  let testDir: string;
  let context: ToolUseContext;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-test-'));
    
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'src', 'components'));
    await fs.mkdir(path.join(testDir, 'tests'));
    
    await fs.writeFile(path.join(testDir, 'index.ts'), 'export {}');
    await fs.writeFile(path.join(testDir, 'src', 'main.ts'), 'console.log()');
    await fs.writeFile(path.join(testDir, 'src', 'utils.ts'), 'export {}');
    await fs.writeFile(path.join(testDir, 'src', 'components', 'App.tsx'), 'export {}');
    await fs.writeFile(path.join(testDir, 'tests', 'test.spec.ts'), 'test()');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
    
    context = {
      stateStore: {} as any,
      permissionContext: {} as any,
      workspaceDir: testDir,
    };
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('应该找到所有 TypeScript 文件', async () => {
    const result = await globTool.execute({ pattern: '**/*.ts' }, context);
    
    expect(result.count).toBeGreaterThanOrEqual(3);
    expect(result.files).toContain('index.ts');
    expect(result.files.some(f => f.includes('main.ts'))).toBe(true);
    expect(result.truncated).toBe(false);
  });

  test('应该找到特定目录下的文件', async () => {
    const result = await globTool.execute(
      { pattern: '*.ts', path: 'src' },
      context
    );
    
    expect(result.count).toBe(2);
    expect(result.files).toContain('main.ts');
    expect(result.files).toContain('utils.ts');
  });

  test('应该找到 TSX 文件', async () => {
    const result = await globTool.execute({ pattern: '**/*.tsx' }, context);
    
    expect(result.count).toBe(1);
    expect(result.files.some(f => f.includes('App.tsx'))).toBe(true);
  });

  test('应该找到测试文件', async () => {
    const result = await globTool.execute({ pattern: '**/*.spec.ts' }, context);
    
    expect(result.count).toBe(1);
    expect(result.files.some(f => f.includes('test.spec.ts'))).toBe(true);
  });

  test('应该处理不存在的目录', async () => {
    await expect(
      globTool.execute({ pattern: '*.ts', path: 'nonexistent' }, context)
    ).rejects.toThrow('目录不存在');
  });

  test('应该返回空结果当没有匹配时', async () => {
    const result = await globTool.execute({ pattern: '**/*.java' }, context);
    
    expect(result.count).toBe(0);
    expect(result.files).toEqual([]);
  });
});
