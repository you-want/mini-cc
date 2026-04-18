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
      const tool = tools.find((t: any) => t.name === call.name);
      
      if (!tool) {
        console.error(`[Agent] 未知工具: ${call.name}`);
        results.push({
          id: call.id,
          name: call.name,
          result: `未知的工具调用: ${call.name}`,
          isError: true,
        });
        continue;
      }

      try {
        // 调用对应工具的 execute 方法
        const result = await tool.execute(call.args);
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
      while (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.handleToolCalls(response.toolCalls);
        
        // 第三步：将所有工具执行的结果统一发回给大模型，让它决定下一步行动
        response = await this.provider.sendToolResults(toolResults, onTextResponse);
      }

      // 当 toolCalls 为空时，循环自动退出，一轮任务处理完毕
    } catch (error: any) {
      console.error(`\n[Agent 报错] ${error.message}`);
    }
  }
}
