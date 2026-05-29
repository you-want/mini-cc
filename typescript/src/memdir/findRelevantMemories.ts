/**
 * 查找与查询相关的记忆文件
 * 
 * 通过扫描记忆文件头信息，并使用 AI 模型选择最相关的记忆文件
 */

import { scanMemoryFiles, formatMemoryManifest, type MemoryHeader } from './memoryScan';

export type RelevantMemory = {
  path: string;
  mtimeMs: number;
};

const SELECT_MEMORIES_SYSTEM_PROMPT = `You are selecting memories that will be useful to the AI assistant as it processes a user's query. You will be given the user's query and a list of available memory files with their filenames and descriptions.

Return a list of filenames for the memories that will clearly be useful as it processes the user's query (up to 5). Only include memories that you are certain will be helpful based on their name and description.
- If you are unsure if a memory will be useful in processing the user's query, then do not include it in your list. Be selective and discerning.
- If there are no memories in the list that would clearly be useful, feel free to return an empty list.
- If a list of recently-used tools is provided, do not select memories that are usage reference or API documentation for those tools (the assistant is already exercising them). DO still select memories containing warnings, gotchas, or known issues about those tools — active use is exactly when those matter.
`;

/**
 * 查找与查询相关的记忆文件
 * 
 * 通过扫描记忆文件头信息并使用 AI 模型选择最相关的记忆
 * 返回最多 5 个最相关记忆的绝对文件路径和修改时间
 * 
 * @param query 用户查询
 * @param memoryDir 记忆目录路径
 * @param signal 中止信号
 * @param recentTools 最近使用的工具列表
 * @param alreadySurfaced 已经展示过的记忆路径集合
 * @returns 相关记忆列表
 */
export async function findRelevantMemories(
  query: string,
  memoryDir: string,
  signal: AbortSignal,
  recentTools: readonly string[] = [],
  alreadySurfaced: ReadonlySet<string> = new Set(),
): Promise<RelevantMemory[]> {
  // 扫描记忆文件，过滤掉已经展示过的
  const memories = (await scanMemoryFiles(memoryDir, signal)).filter(
    m => !alreadySurfaced.has(m.filePath)
  );
  
  if (memories.length === 0) {
    return [];
  }

  // 使用 AI 模型选择相关记忆
  const selectedFilenames = await selectRelevantMemories(
    query,
    memories,
    signal,
    recentTools,
  );
  
  // 根据文件名查找对应的记忆头信息
  const byFilename = new Map(memories.map(m => [m.filename, m]));
  const selected = selectedFilenames
    .map(filename => byFilename.get(filename))
    .filter((m): m is MemoryHeader => m !== undefined);

  return selected.map(m => ({ path: m.filePath, mtimeMs: m.mtimeMs }));
}

/**
 * 使用 AI 模型选择相关记忆
 * 
 * 这是一个简化版本，实际的 Claude Code 会调用 Anthropic API
 * 这里我们使用简单的关键词匹配作为后备方案
 */
async function selectRelevantMemories(
  query: string,
  memories: MemoryHeader[],
  signal: AbortSignal,
  recentTools: readonly string[],
): Promise<string[]> {
  const validFilenames = new Set(memories.map(m => m.filename));
  const manifest = formatMemoryManifest(memories);

  // 构建工具提示
  const toolsSection =
    recentTools.length > 0
      ? `\n\nRecently used tools: ${recentTools.join(', ')}`
      : '';

  try {
    // TODO: 这里应该调用 AI 模型进行智能选择
    // 目前使用简单的关键词匹配作为后备
    const result = await selectMemoriesWithKeywordMatching(
      query,
      memories,
      recentTools
    );
    
    return result.filter(f => validFilenames.has(f));
  } catch (e) {
    if (signal.aborted) {
      return [];
    }
    console.warn(`[memdir] selectRelevantMemories failed: ${e}`);
    return [];
  }
}

/**
 * 使用关键词匹配选择相关记忆（后备方案）
 * 
 * 实际的 Claude Code 会使用 AI 模型进行更智能的选择
 */
async function selectMemoriesWithKeywordMatching(
  query: string,
  memories: MemoryHeader[],
  recentTools: readonly string[]
): Promise<string[]> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  // 计算每个记忆的相关性分数
  const scored = memories.map(memory => {
    let score = 0;
    const searchText = `${memory.filename} ${memory.description || ''}`.toLowerCase();
    
    // 关键词匹配
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        score += 1;
      }
    }
    
    // 如果是最近使用的工具的文档，降低分数
    for (const tool of recentTools) {
      if (searchText.includes(tool.toLowerCase()) && 
          (searchText.includes('api') || searchText.includes('reference'))) {
        score -= 2;
      }
    }
    
    return { memory, score };
  });
  
  // 按分数排序，取前 5 个
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.memory.filename);
}
