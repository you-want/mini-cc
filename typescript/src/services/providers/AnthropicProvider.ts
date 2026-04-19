import Anthropic from '@anthropic-ai/sdk';
import { tools } from '../../infrastructure/tools';
import { LLMProvider, ProviderResponse } from './index';

export function createAnthropicProvider(apiKey: string, model: string = 'claude-3-7-sonnet-20250219'): LLMProvider {
  const anthropic = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [];
  const systemPrompt = '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。';

  const getTools = (): Anthropic.Tool[] => {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as any,
    }));
  };

  const createMessage = async (onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 4096,
      tools: getTools(),
      messages,
      system: systemPrompt,
    });

    let fullContent = '';
    let isContentStarted = false;

    stream.on('text', (textDelta: string) => {
      if (!isContentStarted) {
        onTextResponse('\n' + '='.repeat(20) + ' 模型回复 ' + '='.repeat(20) + '\n', false);
        isContentStarted = true;
      }
      fullContent += textDelta;
      onTextResponse(textDelta, false);
    });

    const response = await stream.finalMessage();

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const textBlocks = response.content.filter((b: any) => b.type === 'text') as Anthropic.Messages.TextBlock[];
    let combinedText = fullContent;
    
    if (!isContentStarted && textBlocks.length > 0) {
      onTextResponse('\n' + '='.repeat(20) + ' 模型回复 ' + '='.repeat(20) + '\n', false);
      for (const block of textBlocks) {
        if (block.text.trim()) {
          combinedText += block.text + '\n';
          onTextResponse(block.text, false);
        }
      }
    }

    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[];
    const toolCalls = toolUseBlocks.map(b => ({
      id: b.id,
      name: b.name,
      args: b.input,
    }));

    onTextResponse('\n', false);

    return { text: combinedText, toolCalls };
  };

  return {
    sendMessage: async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      messages.push({ role: 'user', content: userMessage });
      return createMessage(onTextResponse);
    },
    sendToolResults: async (results: { id: string; name: string; result: string; isError?: boolean }[], onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = results.map(r => ({
        type: 'tool_result',
        tool_use_id: r.id,
        content: r.result,
        is_error: r.isError,
      }));

      messages.push({ role: 'user', content: toolResultBlocks });
      return createMessage(onTextResponse);
    }
  };
}
