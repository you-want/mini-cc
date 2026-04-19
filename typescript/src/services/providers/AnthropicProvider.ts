import Anthropic from '@anthropic-ai/sdk';
import { tools } from '../../infrastructure/tools';
import { LLMProvider, ProviderResponse } from './index';

/**
 * 创建 Anthropic 模型服务商实例
 * 封装了与 Claude 3 等官方模型的交互逻辑，处理了流式输出、工具注册和消息组装。
 * 
 * @param apiKey Anthropic API Key
 * @param model 模型版本名称，默认使用 claude-3-7-sonnet-20250219
 */
export function createAnthropicProvider(apiKey: string, model: string = 'claude-3-7-sonnet-20250219'): LLMProvider {
  // 初始化 Anthropic SDK 客户端
  const anthropic = new Anthropic({ apiKey });
  
  // 会话上下文数组，用于保存历史记录（Agent 的记忆）
  const messages: Anthropic.MessageParam[] = [];
  
  // 系统提示词 (System Prompt)，定义了 AI 的角色、能力范围和默认行为准则
  const systemPrompt = '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。';

  /**
   * 将系统内部的 Tool 接口转换为 Anthropic SDK 识别的工具格式
   */
  const getTools = (): Anthropic.Tool[] => {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as any,
    }));
  };

  /**
   * 核心：发起大模型请求并处理流式响应
   * 
   * @param onTextResponse 流式回调函数，将收到的文字实时推送到终端
   */
  const createMessage = async (onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
    // 发起流式请求
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 4096, // 设置生成内容的最大 token 数
      tools: getTools(),
      messages,
      system: systemPrompt,
    });

    let fullContent = '';
    let isContentStarted = false;

    // 监听文本块的生成，实现流式打字机效果
    stream.on('text', (textDelta: string) => {
      if (!isContentStarted) {
        onTextResponse('\n' + '='.repeat(20) + ' 模型回复 ' + '='.repeat(20) + '\n', false);
        isContentStarted = true;
      }
      fullContent += textDelta;
      onTextResponse(textDelta, false);
    });

    // 等待流结束并获取最终完整的 Message 对象
    const response = await stream.finalMessage();

    // 将 AI 的回复追加到上下文中
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // 提取所有的文本块
    const textBlocks = response.content.filter((b: any) => b.type === 'text') as Anthropic.Messages.TextBlock[];
    let combinedText = fullContent;
    
    // 如果没有触发 text 流事件（例如网络很快瞬间完成），作为降级补充
    if (!isContentStarted && textBlocks.length > 0) {
      onTextResponse('\n' + '='.repeat(20) + ' 模型回复 ' + '='.repeat(20) + '\n', false);
      for (const block of textBlocks) {
        if (block.text.trim()) {
          combinedText += block.text + '\n';
          onTextResponse(block.text, false);
        }
      }
    }

    // 提取工具调用请求块 (tool_use)
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[];
    const toolCalls = toolUseBlocks.map(b => ({
      id: b.id,
      name: b.name,
      args: b.input,
    }));

    onTextResponse('\n', false);

    // 返回组装好的标准 ProviderResponse
    return { text: combinedText, toolCalls };
  };

  return {
    sendMessage: async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      // 追加用户的提问到上下文中
      messages.push({ role: 'user', content: userMessage });
      return createMessage(onTextResponse);
    },
    sendToolResults: async (results: { id: string; name: string; result: string; isError?: boolean }[], onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      // 将工具的执行结果封装为 Anthropic 要求的 tool_result 块
      const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = results.map(r => ({
        type: 'tool_result',
        tool_use_id: r.id,
        content: r.result,
        is_error: r.isError, // 标识该工具调用是否发生错误，以便 AI 可以重试或修正
      }));

      messages.push({ role: 'user', content: toolResultBlocks });
      return createMessage(onTextResponse);
    }
  };
}
