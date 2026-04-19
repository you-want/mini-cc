import { tools } from '../tools';
import { LLMProvider, ToolCall } from './providers';

export interface Agent {
  chat: (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void) => Promise<void>;
}

export function createAgent(provider: LLMProvider): Agent {
  const handleToolCalls = async (
    toolCalls: ToolCall[]
  ): Promise<{ id: string; name: string; result: string; isError: boolean }[]> => {
    const results: { id: string; name: string; result: string; isError: boolean }[] = [];

    for (const call of toolCalls) {
      if (call.args && call.args._parse_error) {
        results.push({
          id: call.id,
          name: call.name,
          result: `[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n请检查是否忘记转义换行符、引号等特殊字符。\n你输出的原始参数为:\n${call.args._raw_arguments}`,
          isError: true,
        });
        continue;
      }

      const tool = tools.find((t: any) => t.name === call.name);
      
      if (!tool) {
        console.error(`\x1b[31m[Agent] 未知工具: ${call.name}\x1b[0m`);
        results.push({
          id: call.id,
          name: call.name,
          result: `未知的工具调用: ${call.name}`,
          isError: true,
        });
        continue;
      }

      try {
        console.log(`\x1b[36m▶ [Agent] 正在调用工具: ${call.name} ...\x1b[0m`);
        let result = await tool.execute(call.args);
        console.log(`\x1b[32m✔ [Agent] 工具 ${call.name} 执行完毕。\x1b[0m`);
        
        if (typeof result === 'string' && result.length > 8000) {
          console.warn(`\n[上下文瘦身] 工具 ${call.name} 返回结果过长 (${result.length} 字符)，已触发 microcompact 截断。`);
          result = result.substring(0, 8000) + '\n\n...[由于内容过长，已被系统 microcompact 机制截断]...';
        }

        results.push({
          id: call.id,
          name: call.name,
          result,
          isError: false,
        });
      } catch (error: any) {
        results.push({
          id: call.id,
          name: call.name,
          result: `执行工具 ${call.name} 时出错: ${error.message}`,
          isError: true,
        });
      }
    }

    return results;
  };

  const chat = async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<void> => {
    try {
      let response = await provider.sendMessage(userMessage, onTextResponse);

      let loopCount = 0;
      const maxLoops = 5;
      
      while (response.toolCalls && response.toolCalls.length > 0) {
        loopCount++;
        if (loopCount > maxLoops) {
          console.warn(`\n\x1b[33m[Agent] 工具调用循环次数过多 (${loopCount})，为防止无限循环，已强制终止。\x1b[0m`);
          break;
        }

        console.log(`\n\x1b[33m[Agent] 收到大模型指令，准备执行 ${response.toolCalls.length} 个工具调用... (第 ${loopCount} 轮)\x1b[0m`);
        const toolResults = await handleToolCalls(response.toolCalls);
        
        console.log(`\n\x1b[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\x1b[0m\n`);
        response = await provider.sendToolResults(toolResults, onTextResponse);
      }
    } catch (error: any) {
      console.error(`\n[Agent 报错] ${error.message}`);
    }
  };

  return { chat };
}
