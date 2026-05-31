/**
 * 上下文压缩机制（Context Compression）
 * 
 * 功能：
 * 1. 剥离图片和文档以节省 Token
 * 2. PTL (Prompt Too Long) 重试机制
 * 3. 对话历史压缩和总结
 */

import { groupMessagesByApiRound } from './grouping';
import { getCompactPrompt, getCompactUserSummaryMessage } from './prompt';

export interface Block {
  type: string;
  text?: string;
  source?: any;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Block[];
  uuid?: string;
  [key: string]: any;
}

export interface CompactionResult {
  summaryMessages: Message[];
  preCompactTokenCount?: number;
  postCompactTokenCount?: number;
}

const PROMPT_TOO_LONG_ERROR_MESSAGE = 'API Error: Prompt too long';
const MAX_PTL_RETRIES = 3;

/**
 * 剥离图片与文档，节省 Token
 */
export function stripImagesFromMessages(messages: Message[]): Message[] {
  return messages.map(message => {
    if (message.role !== 'user' || !Array.isArray(message.content)) {
      return message;
    }

    let hasMediaBlock = false;
    const newContent = message.content.map(block => {
      if (block.type === 'image') {
        hasMediaBlock = true;
        console.warn(`[上下文压缩] 检测到图片块，已替换为 [image] 占位符以节省 Token`);
        return { type: 'text', text: '[image]' };
      }
      if (block.type === 'document') {
        hasMediaBlock = true;
        console.warn(`[上下文压缩] 检测到文档块，已替换为 [document] 占位符以节省 Token`);
        return { type: 'text', text: '[document]' };
      }
      return block;
    });

    return hasMediaBlock ? { ...message, content: newContent } : message;
  });
}

/**
 * 获取 PTL 超出的 Token 数量
 */
function getPromptTooLongTokenGap(errorResponse: any): number | undefined {
  if (errorResponse?.error?.message?.includes('maximum context length')) {
    const match = errorResponse.error.message.match(/(\d+)\s*tokens/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 5000;
  }
  return undefined;
}

/**
 * 粗略估算消息的 Token 数量
 */
export function roughTokenCountEstimationForMessages(messages: Message[]): number {
  return messages.reduce((acc, msg) => {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return acc + Math.ceil(text.length / 4);
  }, 0);
}

/**
 * PTL 重试机制：截断头部消息
 */
export function truncateHeadForPTLRetry(
  input: Message[],
  errorResponse: any
): Message[] | null {
  const groups = groupMessagesByApiRound(input);
  
  if (groups.length < 2) {
    console.error(`[逃生舱失败] 历史消息太短，无法进一步丢弃头部上下文`);
    return null;
  }

  const tokenGap = getPromptTooLongTokenGap(errorResponse);
  let dropCount = 0;
  
  if (tokenGap !== undefined) {
    let acc = 0;
    for (const g of groups) {
      acc += roughTokenCountEstimationForMessages(g);
      dropCount++;
      if (acc >= tokenGap) break;
    }
    console.warn(`[绝境逃生舱] 明确超出 ${tokenGap} tokens，精准丢弃最老的 ${dropCount} 轮上下文`);
  } else {
    dropCount = Math.max(1, Math.floor(groups.length * 0.2));
    console.warn(`[绝境逃生舱] 未知超出 Token 数，默认丢弃最老的 ${dropCount} 轮上下文 (约 20%)`);
  }

  dropCount = Math.min(dropCount, groups.length - 1);
  if (dropCount < 1) return null;

  const sliced = groups.slice(dropCount).flat();
  return sliced;
}

/**
 * 压缩对话历史
 */
export async function compactConversation(
  messages: Message[],
  customInstructions?: string
): Promise<CompactionResult> {
  if (messages.length === 0) {
    throw new Error('Not enough messages to compact.');
  }

  const preCompactTokenCount = roughTokenCountEstimationForMessages(messages);
  
  console.log(`[压缩] 开始压缩对话，当前 Token 数: ${preCompactTokenCount}`);

  const strippedMessages = stripImagesFromMessages(messages);
  const compactPrompt = getCompactPrompt(customInstructions);
  const summary = await generateSummary(strippedMessages, compactPrompt);
  
  const summaryMessage: Message = {
    type: 'user',
    role: 'user',
    content: getCompactUserSummaryMessage(summary, false),
  };
  
  const postCompactTokenCount = roughTokenCountEstimationForMessages([summaryMessage]);
  
  console.log(`[压缩] 压缩完成，压缩后 Token 数: ${postCompactTokenCount}`);
  console.log(`[压缩] Token 节省: ${preCompactTokenCount - postCompactTokenCount} (${Math.round((1 - postCompactTokenCount / preCompactTokenCount) * 100)}%)`);

  return {
    summaryMessages: [summaryMessage],
    preCompactTokenCount,
    postCompactTokenCount,
  };
}

/**
 * 生成对话总结（简化版本）
 */
async function generateSummary(messages: Message[], prompt: string): Promise<string> {
  const keyPoints: string[] = [];
  
  for (const message of messages) {
    const content = typeof message.content === 'string' 
      ? message.content 
      : message.content.map(b => b.text || '').join(' ');
    
    if (content.length > 50) {
      keyPoints.push(`[${message.role}] ${content.slice(0, 200)}...`);
    }
  }
  
  return `对话总结：
  
共 ${messages.length} 条消息，主要内容包括：

${keyPoints.slice(0, 5).join('\n\n')}

${keyPoints.length > 5 ? `\n...以及其他 ${keyPoints.length - 5} 个要点` : ''}`;
}
