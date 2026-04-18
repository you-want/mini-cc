export interface ToolCall {
  id: string;
  name: string;
  args: any;
}

export interface ProviderResponse {
  text: string;
  toolCalls: ToolCall[];
}

/**
 * LLMProvider 接口
 * 
 * 抽象出统一的大模型接口，允许底层支持 Anthropic、OpenAI 甚至其他兼容模型
 */
export interface LLMProvider {
  /**
   * 发送用户消息给模型，并获取回复
   * @param userMessage 用户输入的文本
   * @param onTextResponse 实时/批量处理文本回复的回调
   */
  sendMessage(userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse>;

  /**
   * 发送工具调用的执行结果给模型，并获取下一步指示
   * @param results 工具执行结果数组
   * @param onTextResponse 实时/批量处理文本回复的回调
   */
  sendToolResults(
    results: { id: string; name: string; result: string; isError?: boolean }[],
    onTextResponse: (text: string, isThinking?: boolean) => void
  ): Promise<ProviderResponse>;
}
