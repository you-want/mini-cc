import OpenAI from 'openai';
import { tools } from '../../tools';
import { LLMProvider, ProviderResponse } from './index';

export function createOpenAIProvider(apiKey: string, baseURL?: string, model: string = 'gpt-4o'): LLMProvider {
  const openai = new OpenAI({ apiKey, baseURL });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  
  messages.push({
    role: 'system',
    content: '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。'
  });

  const getTools = (): OpenAI.Chat.ChatCompletionTool[] => {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as any,
      }
    }));
  };

  const fixJsonString = (raw: string): string => {
    return raw
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  };

  const createMessage = async (onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
    const requestOptions: any = {
      model,
      messages,
      tools: getTools(),
      temperature: 0.2,
      stream: true,
      enable_thinking: true
    };

    const stream = await openai.chat.completions.create(requestOptions) as any;

    let fullContent = '';
    let fullReasoning = '';
    let toolCallsMap: Record<number, any> = {};
    let isThinkingStarted = false;
    let isContentStarted = false;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        if (!isThinkingStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 思考过程 ' + '='.repeat(20) + '\n', true);
          isThinkingStarted = true;
        }
        fullReasoning += delta.reasoning_content;
        onTextResponse(delta.reasoning_content, true);
      }

      if (delta.content) {
        if (!isContentStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 完整回复 ' + '='.repeat(20) + '\n', false);
          isContentStarted = true;
        }
        fullContent += delta.content;
        onTextResponse(delta.content, false);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsMap[tc.index]) {
            toolCallsMap[tc.index] = {
              id: tc.id || `call_${Date.now()}_${tc.index}`,
              type: 'function',
              function: { name: tc.function?.name || '', arguments: '' }
            };
          } else {
            if (tc.id) {
              toolCallsMap[tc.index].id = tc.id;
            }
            if (tc.function?.name) {
               toolCallsMap[tc.index].function.name += tc.function.name;
            }
          }
          
          if (tc.function?.arguments) {
            toolCallsMap[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }
    }

    onTextResponse('\n', false);

    const assistantMsg: any = {
      role: 'assistant',
      content: fullContent || null,
    };
    
    const toolCalls = Object.values(toolCallsMap).map((t: any) => {
      let args = {};
      try {
        let rawArgs = t.function.arguments || '{}';
        try {
          args = JSON.parse(rawArgs);
        } catch {
          rawArgs = fixJsonString(rawArgs);
          args = JSON.parse(rawArgs);
        }
      } catch (e) {
        console.error(`\n[OpenAIProvider] 工具参数 JSON 解析失败。原始参数:\n${t.function.arguments}`);
        args = { _parse_error: true, _raw_arguments: t.function.arguments };
      }
      return { id: t.id, name: t.function.name, args };
    });

    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = Object.values(toolCallsMap);
    }
    
    messages.push(assistantMsg);

    return { text: fullContent, toolCalls };
  };

  return {
    sendMessage: async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      messages.push({ role: 'user', content: userMessage });
      return createMessage(onTextResponse);
    },
    sendToolResults: async (results: { id: string; name: string; result: string; isError?: boolean }[], onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
      for (const r of results) {
        messages.push({
          role: 'tool',
          tool_call_id: r.id,
          content: r.result,
        });
      }
      
      return createMessage(onTextResponse);
    }
  };
}
