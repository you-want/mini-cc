/**
 * Memory-directory scanning primitives
 * 记忆目录扫描原语
 * 
 * 功能：扫描记忆目录，读取 frontmatter，返回记忆文件头信息列表
 */

import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';

export type MemoryType = 'fact' | 'decision' | 'preference' | 'convention' | 'note';

export type MemoryHeader = {
  filename: string;
  filePath: string;
  mtimeMs: number;
  description: string | null;
  type: MemoryType | undefined;
};

const MAX_MEMORY_FILES = 200;
const FRONTMATTER_MAX_LINES = 30;

/**
 * 解析 frontmatter 中的 type 字段
 */
export function parseMemoryType(typeStr: string | undefined): MemoryType | undefined {
  if (!typeStr) return undefined;
  const normalized = typeStr.toLowerCase().trim();
  const validTypes: MemoryType[] = ['fact', 'decision', 'preference', 'convention', 'note'];
  return validTypes.includes(normalized as MemoryType) ? (normalized as MemoryType) : undefined;
}

/**
 * 简单的 frontmatter 解析器
 * 支持 YAML 风格的 frontmatter: ---\nkey: value\n---
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = content.split('\n');
  
  // 检查是否以 --- 开头
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: content };
  }

  // 找到结束的 ---
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  // 解析 frontmatter
  const frontmatter: Record<string, string> = {};
  for (let i = 1; i < endIndex; i++) {
    const line = lines[i];
    if (!line) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  const body = lines.slice(endIndex + 1).join('\n');
  return { frontmatter, body };
}

/**
 * 读取文件的前 N 行
 */
async function readFileInRange(
  filePath: string,
  startLine: number,
  maxLines: number,
  signal?: AbortSignal
): Promise<{ content: string; mtimeMs: number }> {
  const fs = await import('fs/promises');
  
  // 获取文件修改时间
  const stats = await stat(filePath);
  const mtimeMs = stats.mtimeMs;

  // 读取文件内容
  const fullContent = await fs.readFile(filePath, 'utf-8');
  const lines = fullContent.split('\n');
  const content = lines.slice(startLine, startLine + maxLines).join('\n');

  return { content, mtimeMs };
}

/**
 * 扫描记忆目录，返回记忆文件头信息列表
 * 
 * 单次遍历：readFileInRange 内部会 stat 并返回 mtimeMs，
 * 所以我们采用 read-then-sort 而不是 stat-sort-read。
 * 对于常见情况（N ≤ 200），这比单独的 stat 轮次减少了一半的系统调用。
 */
export async function scanMemoryFiles(
  memoryDir: string,
  signal?: AbortSignal
): Promise<MemoryHeader[]> {
  try {
    const entries = await readdir(memoryDir, { recursive: true });
    const mdFiles = entries.filter(
      f => f.endsWith('.md') && basename(f) !== 'MEMORY.md'
    );

    const headerResults = await Promise.allSettled(
      mdFiles.map(async (relativePath): Promise<MemoryHeader> => {
        const filePath = join(memoryDir, relativePath);
        const { content, mtimeMs } = await readFileInRange(
          filePath,
          0,
          FRONTMATTER_MAX_LINES,
          signal
        );
        
        const { frontmatter } = parseFrontmatter(content);
        
        return {
          filename: relativePath,
          filePath,
          mtimeMs,
          description: frontmatter.description || null,
          type: parseMemoryType(frontmatter.type),
        };
      })
    );

    return headerResults
      .filter(
        (r): r is PromiseFulfilledResult<MemoryHeader> =>
          r.status === 'fulfilled'
      )
      .map(r => r.value)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_MEMORY_FILES);
  } catch {
    return [];
  }
}

/**
 * 格式化记忆头信息为文本清单
 * 格式：[type] filename (timestamp): description
 * 
 * 用于记忆召回选择器提示和提取代理提示
 */
export function formatMemoryManifest(memories: MemoryHeader[]): string {
  return memories
    .map(m => {
      const tag = m.type ? `[${m.type}] ` : '';
      const ts = new Date(m.mtimeMs).toISOString();
      return m.description
        ? `- ${tag}${m.filename} (${ts}): ${m.description}`
        : `- ${tag}${m.filename} (${ts})`;
    })
    .join('\n');
}
