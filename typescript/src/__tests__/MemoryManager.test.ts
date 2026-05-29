/**
 * MemoryManager 单元测试
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMemoryManager } from '../memdir/MemoryManager';

describe('MemoryManager', () => {
  let tempDir: string;
  let memoryManager: ReturnType<typeof createMemoryManager>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-cc-memory-test-'));
    memoryManager = createMemoryManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('saveMemory', () => {
    it('应该创建 .ai_memory 目录', () => {
      memoryManager.saveMemory('test_topic', '测试详情内容', '测试摘要');
      const memDir = path.join(tempDir, '.ai_memory');
      expect(fs.existsSync(memDir)).toBe(true);
    });

    it('应该创建 MEMORY.md 索引文件', () => {
      memoryManager.saveMemory('test_topic', '测试详情内容', '测试摘要');
      const indexPath = path.join(tempDir, '.ai_memory', 'MEMORY.md');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('应该创建独立的记忆文件', () => {
      memoryManager.saveMemory('test_topic', '测试详情内容', '测试摘要');
      const memoryFile = path.join(tempDir, '.ai_memory', 'test_topic.md');
      expect(fs.existsSync(memoryFile)).toBe(true);
    });

    it('记忆文件应该包含详情内容', () => {
      memoryManager.saveMemory('test_topic', '这是测试详情内容', '测试摘要');
      const memoryFile = path.join(tempDir, '.ai_memory', 'test_topic.md');
      const content = fs.readFileSync(memoryFile, 'utf-8');
      expect(content).toContain('这是测试详情内容');
    });

    it('索引文件应该包含记忆链接', () => {
      memoryManager.saveMemory('test_topic', '测试详情', '测试摘要');
      const indexPath = path.join(tempDir, '.ai_memory', 'MEMORY.md');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('test_topic');
    });

    it('索引行应该限制摘要长度', () => {
      const longSummary = 'A'.repeat(150);
      memoryManager.saveMemory('long_topic', '详情', longSummary);
      const indexPath = path.join(tempDir, '.ai_memory', 'MEMORY.md');
      const content = fs.readFileSync(indexPath, 'utf-8');
      const indexLine = content.split('\n').find(line => line.includes('long_topic'));
      expect(indexLine).toBeDefined();
      expect(indexLine!.length).toBeLessThanOrEqual(150);
    });

    it('可以保存多条记忆', () => {
      memoryManager.saveMemory('topic1', '详情1', '摘要1');
      memoryManager.saveMemory('topic2', '详情2', '摘要2');
      const memDir = path.join(tempDir, '.ai_memory');
      const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('readMemoryIndex', () => {
    it('应该读取索引内容', () => {
      memoryManager.saveMemory('test_topic', '测试详情', '测试摘要');
      const index = memoryManager.readMemoryIndex();
      expect(index).toContain('test_topic');
    });

    it('初始状态应返回空字符串', () => {
      memoryManager = createMemoryManager(tempDir);
      const index = memoryManager.readMemoryIndex();
      expect(index).toContain('全局记忆索引');
    });
  });

  describe('truncateEntrypointContent', () => {
    it('应该截断超过10行的索引', () => {
      memoryManager.saveMemory('topic1', '详情1', '摘要1');
      memoryManager.saveMemory('topic2', '详情2', '摘要2');
      memoryManager.saveMemory('topic3', '详情3', '摘要3');
      memoryManager.saveMemory('topic4', '详情4', '摘要4');
      memoryManager.saveMemory('topic5', '详情5', '摘要5');
      memoryManager.saveMemory('topic6', '详情6', '摘要6');
      memoryManager.saveMemory('topic7', '详情7', '摘要7');
      memoryManager.saveMemory('topic8', '详情8', '摘要8');
      memoryManager.saveMemory('topic9', '详情9', '摘要9');
      memoryManager.saveMemory('topic10', '详情10', '摘要10');
      memoryManager.saveMemory('topic11', '详情11', '摘要11');

      const index = memoryManager.readMemoryIndex();
      const lines = index.split('\n').filter(line => line.trim().startsWith('- ['));
      expect(lines.length).toBeLessThanOrEqual(10);
    });
  });
});