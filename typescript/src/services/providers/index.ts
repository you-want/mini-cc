/**
 * 表示大模型发起的一个工具调用请求
 */
export interface ToolCall {
  id: string;   // 工具调用的唯一标识符
  name: string; // 工具名称，如 "BashTool"
  args: any;    // 大模型生成的传入参数
}

/**
 * 大模型返回的响应结果封装
 */
export interface ProviderResponse {
  text: string;           // 大模型的文本回复（如果非流式）
  toolCalls: ToolCall[];  // 大模型请求调用的工具列表
}

/**
 * 大语言模型提供商 (LLM Provider) 接口
 * 
 * 抽象出统一的大模型接口，允许底层自由切换支持 Anthropic、OpenAI 甚至是兼容模型（如 DeepSeek, Qwen 等）。
 * 实现了策略模式 (Strategy Pattern) 在服务层的应用。
 */
export interface LLMProvider {
  /**
   * 发送用户消息给模型，并获取回复
   * @param userMessage 用户输入的文本
   * @param onTextResponse 实时流式处理文本回复的回调函数（支持区分思考过程 isThinking）
   */
  sendMessage(userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse>;

  /**
   * 发送工具调用的执行结果给模型，并获取下一步指示
   * @param results 工具执行结果数组
   * @param onTextResponse 实时流式处理文本回复的回调函数
   */
  sendToolResults(
    results: { id: string; name: string; result: string; isError?: boolean }[],
    onTextResponse: (text: string, isThinking?: boolean) => void
  ): Promise<ProviderResponse>;
}
