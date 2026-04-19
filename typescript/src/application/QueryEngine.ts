import { tools } from '../infrastructure/tools';
import { LLMProvider, ToolCall } from '../services/providers';
import { globalHooks } from '../infrastructure/hooks/hooks';
import { globalAppState } from '../infrastructure/state/AppStateStore';
import { globalPermissionManager } from '../infrastructure/permissions';
import { ToolUseContext } from '../infrastructure/tools/Tool';

/**
 * 智能体（Agent）接口定义
 */
export interface Agent {
  chat: (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void) => Promise<void>;
}

/**
 * 创建应用层的核心：QueryEngine (大模型调度引擎)
 * 负责控制与大模型的交互循环（Main Loop）、处理工具调用指令、触发钩子事件。
 * 对应 Claude Code 架构中的 Application 层核心逻辑。
 *
 * @param provider 注入的大模型服务提供商 (Dependency Injection)
 */
export function createAgent(provider: LLMProvider): Agent {
  
  /**
   * 处理大模型返回的工具调用请求
   */
  const handleToolCalls = async (
    toolCalls: ToolCall[]
  ): Promise<{ id: string; name: string; result: string; isError: boolean }[]> => {
    const results: { id: string; name: string; result: string; isError: boolean }[] = [];

    // 依赖注入 (Dependency Injection): 构造 ToolUseContext 上下文对象
    // 工具的执行不再依赖全局模块，而是通过 context 获取运行时的状态、权限和工作目录
    const context: ToolUseContext = {
      stateStore: globalAppState,
      permissionContext: {
        strategy: 'default',
        allowedTools: new Set(),
        deniedTools: new Set(),
      },
      workspaceDir: process.cwd(),
    };

    for (const call of toolCalls) {
      // 检查大模型生成的 JSON 参数是否解析失败（如：忘记转义）
      if (call.args && call.args._parse_error) {
        results.push({
          id: call.id,
          name: call.name,
          result: `[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n请检查是否忘记转义换行符、引号等特殊字符。\n你输出的原始参数为:\n${call.args._raw_arguments}`,
          isError: true,
        });
        continue;
      }

      // 根据工具名称匹配基础设施层注册的工具
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
        // 事件驱动 (Event-Driven): 触发 PreToolUse 钩子，可以在工具执行前拦截或记录日志
        await globalHooks.trigger('PreToolUse', { toolName: call.name, args: call.args });
        
        console.log(`\x1b[36m▶ [Agent] 正在调用工具: ${call.name} ...\x1b[0m`);
        
        // 依赖注入模式执行工具：传入解析好的参数和上下文环境
        let result = await tool.execute(call.args, context);
        console.log(`\x1b[32m✔ [Agent] 工具 ${call.name} 执行完毕。\x1b[0m`);
        
        // 事件驱动 (Event-Driven): 触发 PostToolUse 钩子，可以在工具执行后处理结果
        await globalHooks.trigger('PostToolUse', { toolName: call.name, result });

        // Microcompact 机制：当工具返回的结果过大（如读取了一个巨型日志文件），进行硬截断
        // 防止上下文被撑爆 (Context window overflow)
        if (typeof result === 'string' && result.length > 8000) {
          // 触发 PreCompact 瘦身前钩子
          await globalHooks.trigger('PreCompact', { toolName: call.name, length: result.length });
          
          console.warn(`\n[上下文瘦身] 工具 ${call.name} 返回结果过长 (${result.length} 字符)，已触发 microcompact 截断。`);
          result = result.substring(0, 8000) + '\n\n...[由于内容过长，已被系统 microcompact 机制截断]...';
          
          // 触发 PostCompact 瘦身后钩子
          await globalHooks.trigger('PostCompact', { toolName: call.name, newLength: result.length });
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

  /**
   * 核心对话主循环 (Main Loop)
   */
  const chat = async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void): Promise<void> => {
    try {
      // 1. 将用户的消息发送给大模型
      let response = await provider.sendMessage(userMessage, onTextResponse);

      let loopCount = 0;
      const maxLoops = 3; // 限制最大连续工具调用轮数，防止 AI 陷入死循环
      
      // 2. 如果大模型返回了工具调用请求，进入 Agent 循环
      while (response.toolCalls && response.toolCalls.length > 0) {
        loopCount++;
        if (loopCount > maxLoops) {
          console.warn(`\n\x1b[33m[Agent] 工具调用循环次数过多 (${loopCount})，为防止无限循环，已强制终止。\x1b[0m`);
          break;
        }

        console.log(`\n\x1b[33m[Agent] 收到大模型指令，准备执行 ${response.toolCalls.length} 个工具调用... (第 ${loopCount} 轮)\x1b[0m`);
        
        // 执行工具
        const toolResults = await handleToolCalls(response.toolCalls);
        
        console.log(`\n\x1b[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\x1b[0m\n`);
        
        // 3. 将工具执行的结果发回给大模型，获取下一步指示或最终文本回复
        response = await provider.sendToolResults(toolResults, onTextResponse);
      }
    } catch (error: any) {
      console.error(`\n[Agent 报错] ${error.message}`);
    }
  };

  return { chat };
}
