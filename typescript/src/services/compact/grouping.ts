/**
 * 消息分组工具
 * 
 * 将消息按 API 轮次分组，用于压缩时的智能截断
 */

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | any[];
  [key: string]: any;
}

/**
 * 按 API 轮次对消息进行分组
 * 
 * 每个 API 轮次通常包含：
 * - 用户消息
 * - 助手响应
 * - 可能的工具调用和结果
 * 
 * @param messages 消息列表
 * @returns 分组后的消息数组
 */
export function groupMessagesByApiRound(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  
  for (const message of messages) {
    // 如果遇到用户消息且当前组不为空，开始新的一组
    if (message.role === 'user' && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    
    currentGroup.push(message);
  }
  
  // 添加最后一组
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}
