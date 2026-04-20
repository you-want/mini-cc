import fs from 'fs';
import path from 'path';

/**
 * 大道至简：基于文件系统的记忆机制 (Memory Directory)
 * 第四章：教模型做笔记，两步走法则
 *
 * Claude Code 并没有使用花里胡哨的向量数据库 (Vector DB)，
 * 而是极其务实地利用了本地文件系统，外加一段堪称教科书级别的 System Prompt。
 */

export interface MemoryManager {
  truncateEntrypointContent: (rawContent: string) => string;
  saveMemory: (topic: string, details: string, summary: string) => void;
  readMemoryIndex: () => string;
}

/**
 * 创建一个记忆管理器实例 (函数式闭包实现)
 * 
 * @param workspaceDir 工作区目录，默认当前目录
 * @returns 包含记忆操作方法的对象
 */
export function createMemoryManager(workspaceDir: string = process.cwd()): MemoryManager {
  const memDir = path.join(workspaceDir, '.ai_memory');
  const ENTRYPOINT_NAME = 'MEMORY.md';
  const indexPath = path.join(memDir, ENTRYPOINT_NAME);
  
  // 强制死命令：最多 10 行索引（为了演示缩短了原版 200 行的限制）
  const MAX_ENTRYPOINT_LINES = 10;

  // 初始化记忆目录和索引文件
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true });
  }
  
  if (!fs.existsSync(indexPath)) {
    const initialPrompt = [
      '# 全局记忆索引',
      '',
      '> ⚠️ 警告：单条记录必须少于 100 字，总行数不可超过 10 行！',
      '> ',
      '> 💡 如何保存记忆 (How to save memories):',
      '> Saving a memory is a two-step process:',
      '> **Step 1** — 将详细记忆写入独立的文件 (如 `user_role.md`).',
      '> **Step 2** — 在本索引文件中添加指向该文件的单行链接描述.',
      '',
    ].join('\n');
    
    fs.writeFileSync(indexPath, initialPrompt, 'utf-8');
  }

  /**
   * 严防死守的防爆机制
   * 当大模型把索引当成流水账写，导致超过字数限制时，强制截断并附上警告大字报。
   */
  function truncateEntrypointContent(rawContent: string): string {
    const lines = rawContent.split('\n');
    const dataLines = lines.filter(line => line.trim().startsWith('- ['));
    
    if (dataLines.length > MAX_ENTRYPOINT_LINES) {
      console.warn(`[记忆防爆] 索引超长（${dataLines.length} 行），触发强制截断（上限：${MAX_ENTRYPOINT_LINES} 行）`);
      
      // 保留提示行，截去最老的一条数据记录
      const nonDataLines = lines.filter(line => !line.trim().startsWith('- ['));
      const keptDataLines = dataLines.slice(dataLines.length - MAX_ENTRYPOINT_LINES);
      
      const truncated = [...nonDataLines, ...keptDataLines].join('\n');
      
      // 暴力截断，并在末尾贴上大字报警告！
      const warningMsg = `\n\n> WARNING: ${ENTRYPOINT_NAME} is ${dataLines.length} lines (limit: ${MAX_ENTRYPOINT_LINES}). Only part of it was loaded. Keep index entries to one line under ~100 chars...`;
      
      return truncated + warningMsg;
    }
    
    return rawContent;
  }

  /**
   * 两步走法则的落地实现 (给工具调用)
   * 
   * @param topic 记忆的主题（文件名）
   * @param details 详细的记忆内容（写入具体文件）
   * @param summary 一句话精简总结（写入索引文件）
   */
  function saveMemory(topic: string, details: string, summary: string): void {
    // Step 1: 写入详情文件（大模型可以尽情长篇大论）
    const fileName = `${topic.replace(/\s+/g, '_')}.md`;
    fs.writeFileSync(path.join(memDir, fileName), details, 'utf-8');

    // Step 2: 更新索引（严格限制长度）
    const indexLine = `- [${topic}](./${fileName}): ${summary.substring(0, 100)}`;
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    // 追加新记忆
    indexContent += '\n' + indexLine;
    
    // 检查并截断防爆
    const finalContent = truncateEntrypointContent(indexContent);
    
    fs.writeFileSync(indexPath, finalContent, 'utf-8');
    console.log(`✅ [记忆管理] 记忆已保存：${topic}`);
  }
  
  /**
   * 读取当前索引内容，供每次大模型请求前注入上下文
   */
  function readMemoryIndex(): string {
    if (!fs.existsSync(indexPath)) return '';
    return fs.readFileSync(indexPath, 'utf-8');
  }

  return {
    truncateEntrypointContent,
    saveMemory,
    readMemoryIndex
  };
}
