/**
 * MemoryScan 单元测试
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { scanMemoryFiles, formatMemoryManifest, parseMemoryType } from '../memdir/memoryScan';

describe('MemoryScan', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-cc-scan-test-'));
    fs.mkdirSync(path.join(tempDir, '.ai_memory'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseMemoryType', () => {
    it('应该解析有效的类型', () => {
      expect(parseMemoryType('fact')).toBe('fact');
      expect(parseMemoryType('decision')).toBe('decision');
      expect(parseMemoryType('preference')).toBe('preference');
      expect(parseMemoryType('convention')).toBe('convention');
      expect(parseMemoryType('note')).toBe('note');
    });

    it('应该忽略大小写', () => {
      expect(parseMemoryType('FACT')).toBe('fact');
      expect(parseMemoryType('Decision')).toBe('decision');
    });

    it('应该返回 undefined 对于无效类型', () => {
      expect(parseMemoryType('invalid')).toBeUndefined();
      expect(parseMemoryType('')).toBeUndefined();
      expect(parseMemoryType(undefined)).toBeUndefined();
    });
  });

  describe('scanMemoryFiles', () => {
    it('应该返回空数组当目录不存在', async () => {
      const result = await scanMemoryFiles('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('应该扫描 .md 文件', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'test.md'),
        '# Test\nContent here',
        'utf-8'
      );
      const result = await scanMemoryFiles(tempDir);
      expect(result.length).toBe(1);
      expect(result[0].filename).toContain('test.md');
    });

    it('应该排除 MEMORY.md', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'MEMORY.md'),
        '# Index\n- [test]',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'other.md'),
        '# Other',
        'utf-8'
      );
      const result = await scanMemoryFiles(tempDir);
      expect(result.every(m => m.filename !== 'MEMORY.md')).toBe(true);
    });

    it('应该解析 frontmatter 元数据', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'project.md'),
        `---
type: architecture
description: project architecture
---
# Project

This is a test project.`,
        'utf-8'
      );
      const result = await scanMemoryFiles(tempDir);
      expect(result.length).toBe(1);
      expect(result[0].filename).toContain('project.md');
    });

    it('应该按修改时间排序', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'old.md'),
        '# Old',
        'utf-8'
      );
      await new Promise(r => setTimeout(r, 10));
      fs.writeFileSync(
        path.join(tempDir, '.ai_memory', 'new.md'),
        '# New',
        'utf-8'
      );
      const result = await scanMemoryFiles(tempDir);
      expect(result[0].filename).toContain('new.md');
    });

    it('应该限制最多200个文件', async () => {
      for (let i = 0; i < 250; i++) {
        fs.writeFileSync(
          path.join(tempDir, '.ai_memory', `memory_${i}.md`),
          `# Memory ${i}`,
          'utf-8'
        );
      }
      const result = await scanMemoryFiles(tempDir);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe('formatMemoryManifest', () => {
    it('应该格式化记忆清单', () => {
      const memories = [
        {
          filename: 'test.md',
          filePath: '/path/to/test.md',
          mtimeMs: 1000,
          description: '测试描述',
          type: 'fact' as const,
        },
      ];
      const manifest = formatMemoryManifest(memories);
      expect(manifest).toContain('[fact]');
      expect(manifest).toContain('test.md');
      expect(manifest).toContain('测试描述');
    });

    it('应该处理没有描述的记忆', () => {
      const memories = [
        {
          filename: 'test.md',
          filePath: '/path/to/test.md',
          mtimeMs: 1000,
          description: null,
          type: undefined,
        },
      ];
      const manifest = formatMemoryManifest(memories);
      expect(manifest).toContain('test.md');
    });

    it('应该返回空字符串当输入为空', () => {
      const manifest = formatMemoryManifest([]);
      expect(manifest).toBe('');
    });
  });
});