/**
 * 上下文压缩机制（Context Compression）
 * 第四章：断臂求生 - 剥离图片与 PTL 重试
 */

// 简单的通用消息类型定义（为了兼容不同的 Provider，这里做个简化抽象）
export interface Block {
  type: string;
  text?: string;
  source?: any; // image source etc
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Block[];
  [key: string]: any;
}

/**
 * 极致的 Token 抠门：剥离图片与冗余件
 * 将用户消息中的图片或长文档替换为 [image] 或 [document] 占位符。
 * 从而在压缩历史总结时，节省巨大的 Token 开销。
 */
export function stripImagesFromMessages(messages: Message[]): Message[] {
  return messages.map(message => {
    // 只处理 user 类型的消息，并且 content 必须是数组块形式
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

    // 如果没有媒体块，原样返回；否则返回替换后的新消息
    return hasMediaBlock ? { ...message, content: newContent } : message;
  });
}

/**
 * 模拟获取 PTL (Prompt Too Long) 超出的 Token 数量
 * 在真实场景中，这会解析大模型的 400 错误信息（如 "maximum context length is 128000 tokens"）
 */
function getPromptTooLongTokenGap(errorResponse: any): number | undefined {
  if (errorResponse?.error?.message?.includes('maximum context length')) {
    // 假设我们解析出来超出了 5000 tokens
    return 5000; 
  }
  return undefined;
}

/**
 * 粗略估算消息的 Token 数量（真实场景会用 tiktoken 等分词器）
 */
function roughTokenCountEstimationForMessages(messages: Message[]): number {
  return messages.reduce((acc, msg) => {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return acc + Math.ceil(text.length / 4); // 粗略估算：每 4 个字符约等于 1 个 token
  }, 0);
}

/**
 * 绝境逃生舱：PTL (Prompt Too Long) 重试机制
 * 当连发起“压缩总结”这个请求本身都超过了 API 的最大 Token 限制时，
 * 这是最后的自救手段：丢弃最老的历史记录，虽然有损但能防止对话彻底卡死。
 * 
 * @param input 准备发送给大模型的历史消息数组
 * @param errorResponse 大模型返回的报错信息
 * @returns 截断后的新消息数组，如果无法截断则返回 null
 */
export function truncateHeadForPTLRetry(
  input: Message[],
  errorResponse: any
): Message[] | null {
  // 为了简化，我们将输入按轮次分组（这里假设每两条消息算作一轮交互，或直接按条算）
  // 真实场景会有更复杂的 groupMessagesByApiRound 逻辑
  const groups = input.map(msg => [msg]); 
  
  if (groups.length < 2) {
    console.error(`[逃生舱失败] 历史消息太短，无法进一步丢弃头部上下文`);
    return null;
  }

  const tokenGap = getPromptTooLongTokenGap(errorResponse);
  let dropCount = 0;
  
  if (tokenGap !== undefined) {
    // 如果 API 明确告诉了超出的 Token 数量，精准计算要丢弃几条（轮）消息
    let acc = 0;
    for (const g of groups) {
      acc += roughTokenCountEstimationForMessages(g);
      dropCount++;
      if (acc >= tokenGap) break;
    }
    console.warn(`[绝境逃生舱] 明确超出 ${tokenGap} tokens，精准丢弃最老的 ${dropCount} 轮上下文`);
  } else {
    // 当连压缩请求都超载，且不知道超出多少时，默认抛弃最老的 20% 历史记录
    dropCount = Math.max(1, Math.floor(groups.length * 0.2));
    console.warn(`[绝境逃生舱] 未知超出 Token 数，默认丢弃最老的 ${dropCount} 轮上下文 (约 20%)`);
  }

  // 保证至少保留一条消息（通常是系统提示或最新输入）
  if (dropCount >= groups.length) {
    dropCount = groups.length - 1;
  }

  // 直接丢弃头部消息，保留最新内容
  const sliced = groups.slice(dropCount).flat();
  return sliced;
}
