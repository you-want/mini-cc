import OpenAI from 'openai';
import { tools } from '../../tools';
import { LLMProvider, ProviderResponse } from './index';

export class OpenAIProvider implements LLMProvider {
  private openai: OpenAI;
  private messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private model: string;

  constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
    
    // 初始化系统提示词
    this.messages.push({
      role: 'system',
      content: '你是一个名为 mini-claude-code 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。在分析和操作时，请尽可能保持严谨，使用所提供的工具。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。如果该目录不存在，请先使用终端命令创建它。'
    });
  }

  private getTools(): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as any,
      }
    }));
  }

  private async createMessage(onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> {
    const requestOptions: any = {
      model: this.model,
      messages: this.messages,
      tools: this.getTools(),
      temperature: 0.2,
      stream: true,
      // 传递 Qwen 兼容模型所需的参数
      enable_thinking: true
    };

    const stream = await this.openai.chat.completions.create(requestOptions) as any;

    let fullContent = '';
    let fullReasoning = '';
    let toolCallsMap: Record<number, any> = {};
    let isThinkingStarted = false;
    let isContentStarted = false;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 提取思考过程 (reasoning_content)
      // @ts-ignore
      if (delta.reasoning_content) {
        if (!isThinkingStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 思考过程 ' + '='.repeat(20) + '\n', true);
          isThinkingStarted = true;
        }
        // @ts-ignore
        fullReasoning += delta.reasoning_content;
        // @ts-ignore
        onTextResponse(delta.reasoning_content, true);
      }

      // 提取正常回复 (content)
      if (delta.content) {
        if (!isContentStarted) {
          onTextResponse('\n' + '='.repeat(20) + ' 完整回复 ' + '='.repeat(20) + '\n', false);
          isContentStarted = true;
        }
        fullContent += delta.content;
        onTextResponse(delta.content, false);
      }

      // 提取流式工具调用 (tool_calls)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsMap[tc.index]) {
            toolCallsMap[tc.index] = {
              id: tc.id || `call_${Date.now()}_${tc.index}`, // 兜底生成 id
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

    // 维持对话上下文，将助手的回复存入记录
    const assistantMsg: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'assistant',
      content: fullContent || null,
    };
    
    const toolCalls = Object.values(toolCallsMap).map((t: any) => {
      let args = {};
      try {
        // 尝试修复一些常见的 JSON 格式错误（比如 Qwen 容易在 content 里直接输出未转义的换行）
        let rawArgs = t.function.arguments || '{}';
        // 简单的控制字符转义处理，防止 JSON.parse 崩溃
        rawArgs = rawArgs.replace(/\n/g, '\\\\n').replace(/\r/g, '\\\\r').replace(/\t/g, '\\\\t');
        // 有些时候模型会错误地把转义的 \\n 变成实际的换行，上面的正则会把它变成 \\n。
        // 但更稳妥的做法是，如果是标准的合法 JSON，不应该有物理换行，如果有物理换行说明生成有瑕疵。
        args = JSON.parse(rawArgs);
      } catch (e) {
        console.error(`\n[OpenAIProvider] 工具参数 JSON 解析失败。尝试使用原始参数...`);
        // 如果依然失败，给一个特殊标记，让 Agent 能够反馈给模型
        args = { _parse_error: true, _raw_arguments: t.function.arguments };
      }
      return { id: t.id, name: t.function.name, args };
    });

    if (toolCalls.length > 0) {
      // 只有当有工具调用时，才挂载 tool_calls 字段
      assistantMsg.tool_calls = Object.values(toolCallsMap);
    }
    
    this.messages.push(assistantMsg);

    return { text: fullContent, toolCalls };
  }

  public async sendMessage(userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> {
    this.messages.push({ role: 'user', content: userMessage });
    return this.createMessage(onTextResponse);
  }

  public async sendToolResults(results: { id: string; name: string; result: string; isError?: boolean }[], onTextResponse: (text: string, isThinking?: boolean) => void): Promise<ProviderResponse> {
    // OpenAI 格式中，工具执行结果需要以 'tool' 角色的消息形式传入
    for (const r of results) {
      this.messages.push({
        role: 'tool',
        tool_call_id: r.id,
        content: r.result,
      });
    }
    
    return this.createMessage(onTextResponse);
  }
}
