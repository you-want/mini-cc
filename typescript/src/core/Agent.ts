import { tools } from '../tools';
import { LLMProvider, ToolCall } from './providers';

/**
 * Agent 核心类
 * 
 * 作用：管理与 LLM 的多轮对话，解析并分发大模型下发的 Tool Calls。
 * 目前通过依赖注入的方式，解耦了对特定大模型厂商（Anthropic/OpenAI）的硬依赖。
 */
export class Agent {
  /**
   * @param provider 具体的大模型服务提供商实例
   */
  constructor(private provider: LLMProvider) {}

  /**
   * 处理模型请求调用的工具集合
   * 
   * @param toolCalls 模型希望调用的工具请求
   * @returns 工具调用结果，后续需回传给大模型
   */
  private async handleToolCalls(
    toolCalls: ToolCall[]
  ): Promise<{ id: string; name: string; result: string; isError: boolean }[]> {
    const results: { id: string; name: string; result: string; isError: boolean }[] = [];

    // 循环执行每一个工具调用
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
        // 调用对应工具的 execute 方法
        let result = await tool.execute(call.args);
        console.log(`\x1b[32m✔ [Agent] 工具 ${call.name} 执行完毕。\x1b[0m`);
        
        // 【上下文瘦身术】: microcompact 微型压缩 (文档 02)
        // 如果工具返回的结果过长，强制截断以防 Token 爆炸
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
        // 捕获并打包错误信息给大模型
        results.push({
          id: call.id,
          name: call.name,
          result: `执行工具 ${call.name} 时出错: ${error.message}`,
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * 发起一次用户对话，进入核心 Agent 循环
   * 
   * @param userMessage - 用户输入的指令
   * @param onTextResponse - 用于输出模型文字响应的回调
   */
  public async chat(userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<void> {
    try {
      // 第一步：发送用户的原始消息，并获取初步回复（可能是直接回复文本，也可能是触发工具调用）
      let response = await this.provider.sendMessage(userMessage, onTextResponse);

      // 第二步：进入 Tool Use 事件循环（如果模型下发了工具调用）
      // 这个 while 循环使得 Agent 具备了持续思考、连续调用不同工具的能力，直到任务解决
      let loopCount = 0;
      const maxLoops = 5; // 防止无限循环
      
      while (response.toolCalls && response.toolCalls.length > 0) {
        loopCount++;
        if (loopCount > maxLoops) {
          console.warn(`\n\x1b[33m[Agent] 工具调用循环次数过多 (${loopCount})，为防止无限循环，已强制终止。\x1b[0m`);
          break;
        }

        console.log(`\n\x1b[33m[Agent] 收到大模型指令，准备执行 ${response.toolCalls.length} 个工具调用... (第 ${loopCount} 轮)\x1b[0m`);
        const toolResults = await this.handleToolCalls(response.toolCalls);
        
        console.log(`\n\x1b[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\x1b[0m\n`);
        // 第三步：将所有工具执行的结果统一发回给大模型，让它决定下一步行动
        response = await this.provider.sendToolResults(toolResults, onTextResponse);
      }

      // 当 toolCalls 为空时，循环自动退出，一轮任务处理完毕
    } catch (error: any) {
      console.error(`\n[Agent 报错] ${error.message}`);
    }
  }
}
