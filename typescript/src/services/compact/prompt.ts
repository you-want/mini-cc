/**
 * 压缩提示词
 * 
 * 用于生成对话总结的系统提示
 */

/**
 * 获取压缩提示词
 * 
 * @param customInstructions 用户自定义指令
 * @returns 压缩提示词
 */
export function getCompactPrompt(customInstructions?: string): string {
  let prompt = `Please provide a concise summary of the conversation so far. Focus on:
- Key decisions and outcomes
- Important context that should be preserved
- Technical details that matter for future work
- Any unresolved issues or next steps

Keep the summary clear and actionable.`;

  if (customInstructions) {
    prompt += `\n\nAdditional instructions:\n${customInstructions}`;
  }

  return prompt;
}

/**
 * 获取部分压缩提示词
 * 
 * @param customInstructions 用户自定义指令
 * @param direction 压缩方向 ('from' 或 'up_to')
 * @returns 部分压缩提示词
 */
export function getPartialCompactPrompt(
  customInstructions?: string,
  direction: 'from' | 'up_to' = 'from'
): string {
  const directionText = direction === 'from' 
    ? 'the messages after the selected point'
    : 'the messages before the selected point';
    
  let prompt = `Please provide a concise summary of ${directionText}. Focus on:
- Key decisions and outcomes
- Important context that should be preserved
- Technical details that matter for future work
- Any unresolved issues or next steps

Keep the summary clear and actionable.`;

  if (customInstructions) {
    prompt += `\n\nAdditional instructions:\n${customInstructions}`;
  }

  return prompt;
}

/**
 * 获取压缩后的用户总结消息
 * 
 * @param summary 总结内容
 * @param suppressFollowUpQuestions 是否抑制后续问题
 * @param transcriptPath 会话记录路径
 * @returns 格式化的总结消息
 */
export function getCompactUserSummaryMessage(
  summary: string,
  suppressFollowUpQuestions: boolean,
  transcriptPath?: string
): string {
  let message = `[Conversation Summary]\n\n${summary}`;
  
  if (transcriptPath) {
    message += `\n\n(Full conversation history saved to: ${transcriptPath})`;
  }
  
  if (!suppressFollowUpQuestions) {
    message += '\n\nYou can continue the conversation from here.';
  }
  
  return message;
}
