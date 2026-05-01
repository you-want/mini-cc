import OpenAI from 'openai';
import { tools } from '../../infrastructure/tools';
import { LLMProvider, ProviderResponse } from './index';

/**
 * 创建 OpenAI / 兼容大模型服务商实例
 * 封装了与 OpenAI 及其兼容 API (如 Qwen, DeepSeek 等) 的交互逻辑。
 * 特别处理了流式输出中的 reasoning_content (思考过程) 提取。
 * 
 * @param apiKey OpenAI API Key
 * @param baseURL 可选的自定义 API 地址（用于支持兼容模型）
 * @param model 模型名称，默认为 gpt-4o
 */
export function createOpenAIProvider(apiKey: string, baseURL?: string, model: string = 'gpt-4o'): LLMProvider {
  // 初始化 OpenAI 客户端
  const openai = new OpenAI({ apiKey, baseURL });
  
  // 会话上下文数组，保存历史消息
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  
  // 注入系统提示词 (System Prompt)
  messages.push({
    role: 'system',
    content: '你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。注意：写入文件时如果目录不存在，FileWriteTool 会自动为你创建，请不要使用终端命令手动去 mkdir 创建目录。\n\n【防覆盖机制】\n当用户要求“新建”、“生成”某个文件，或者并未明确要求修改旧文件时，你在调用 FileWriteTool 时必须将 `require_new` 参数设置为 `true`。这能保护用户的旧代码不被意外覆盖。如果工具报错提示文件已存在，你应该重新选择一个不同的文件名（例如 `index2.html` 或根据上下文命名）再次尝试，或者向用户确认是否需要覆盖。'
  });

  /**
   * 将内部 Tool 接口转换为 OpenAI 兼容的 function calling 格式
   */
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

  /**
   * 修复由于大模型生成的不规范 JSON 字符串（处理转义字符）
   */
  const fixJsonString = (raw: string): string => {
    return raw
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  };

  /**
   * 核心：发起聊天完成请求并处理流式响应，支持解析 reasoning_content (思维链)
   */
  const createMessage = async (onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> => {
    // 构造请求参数，使用 any 绕过类型检查以支持 Qwen 等独有的 enable_thinking 参数
    const requestOptions: any = {
      model,
      messages,
      tools: getTools(),
      temperature: 0.2,
      stream: true,
      enable_thinking: true // 特殊参数，部分兼容模型需要它来开启思考流
    };

    const stream = await openai.chat.completions.create(requestOptions) as any;

    let fullContent = '';
    let fullReasoning = '';
    let toolCallsMap: Record<number, any> = {};
    let isThinkingStarted = false;
    let isContentStarted = false;

    // 遍历流式数据块
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 提取并推送思维链内容 (如 Qwen 的 reasoning_content)
      if (delta.reasoning_content) {
        if (!isThinkingStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 思考过程 ' + '='.repeat(20) + '\n', true);
          isThinkingStarted = true;
        }
        fullReasoning += delta.reasoning_content;
        onTextResponse(delta.reasoning_content, true);
      }

      // 提取并推送常规文本回复
      if (delta.content) {
        if (!isContentStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 完整回复 ' + '='.repeat(20) + '\n', false);
          isContentStarted = true;
        }
        fullContent += delta.content;
        onTextResponse(delta.content, false);
      }

      // 组装流式的工具调用参数块
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

    // 将 AI 的回复（包括文本和工具调用）追加到上下文
    const assistantMsg: any = {
      role: 'assistant',
      content: fullContent || null,
    };
    
    // 解析合并后的工具调用 JSON 参数
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
      // 封装工具执行结果并追加到上下文
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
