// 引入 tools 模块，用于处理大模型返回的工具调用请求
import { tools } from '../infrastructure/tools';
// 引入 LLMProvider 模块，用于与大模型服务商交互
import { LLMProvider, ToolCall } from '../services/providers';
// 引入 globalHooks 模块，用于触发 AppStart 生命周期钩子等
import { globalHooks } from '../infrastructure/hooks/hooks';
// 引入 globalAppState 模块，用于存储应用状态
import { globalAppState } from '../infrastructure/state/AppStateStore';
// 引入 globalPermissionManager 模块，用于管理应用权限
import { globalPermissionManager } from '../infrastructure/permissions';
// 引入 ToolUseContext 模块，用于定义工具调用的上下文
import { ToolUseContext } from '../infrastructure/tools/Tool';

/**
 * 智能体（Agent）接口定义
 */
export interface Agent {
  chat: (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void, abortSignal?: AbortSignal) => Promise<void>;
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

        // ------------------------------------------------------------------------
        // 【第二章：上下文瘦身术 (Context Compaction) 的 5 道防线】
        // ------------------------------------------------------------------------
        
        // 1. 预算控制 (applyToolResultBudget): 强制给工具结果设定 Token 预算
        // 比如此处限制为 8000 字符，模拟预算控制
        if (typeof result === 'string' && result.length > 8000) {
          // 触发 PreCompact 瘦身前钩子
          await globalHooks.trigger('PreCompact', { toolName: call.name, length: result.length });
          
          console.warn(`\n[上下文瘦身] 工具 ${call.name} 返回结果过长 (${result.length} 字符)，已触发截断 (applyToolResultBudget)。`);
          result = result.substring(0, 8000) + '\n\n...[由于内容过长，已被系统 budget 机制截断]...';
          
          // 触发 PostCompact 瘦身后钩子
          await globalHooks.trigger('PostCompact', { toolName: call.name, newLength: result.length });
        }

        // 2. 历史裁剪 (snipCompactIfNeeded): 裁剪无营养的闲聊释放 Token
        if (typeof result === 'string' && result.includes('没有找到任何相关信息')) {
          console.warn(`\n[上下文瘦身] 检测到无营养的搜索结果，已执行历史裁剪 (snipCompact)。`);
          result = '搜索结果为空。';
        }

        // 3. 微型压缩 (microcompact): 比如修改文件只保留 Diff 差异
        if (call.name === 'FileWriteTool' && typeof result === 'string') {
          console.warn(`\n[上下文瘦身] 触发 microcompact，仅保留文件写入的 Diff 摘要。`);
          result = `[文件写入成功] 成功写入了文件。为节省上下文，此处省略具体的文本写入内容。`;
        }
        
        // 4. 上下文折叠 (contextCollapse): 将中间步骤折叠，只保留最终结论
        if (call.name === 'BashTool' && typeof result === 'string' && result.includes('npm install')) {
          console.warn(`\n[上下文瘦身] 触发 contextCollapse，折叠包管理器的中间日志。`);
          result = `[依赖安装成功] 忽略 npm/pnpm 安装过程日志，只保留最终成功结论。`;
        }

        // 5. 自动总结 (autocompact): 终极杀器，起一个子代理将长篇大论总结成精简摘要
        // 此处用模拟代码展示：当结果仍然超过 3000 字时，进行“自动总结”
        if (typeof result === 'string' && result.length > 3000) {
           console.warn(`\n[上下文瘦身] 工具结果仍然较长 (${result.length} 字符)，触发 autocompact (模拟子代理总结)。`);
           result = `[系统自动总结] 这是对超长内容的 AI 自动摘要：原文包含约 ${result.length} 个字符，主要描述了工具 ${call.name} 的执行输出。为节约 Token 已自动浓缩。` + '\n摘要预览：\n' + result.substring(0, 500) + '...\n';
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
  const chat = async (userMessage: string, onTextResponse: (text: string, isThinking?: boolean) => void, abortSignal?: AbortSignal): Promise<void> => {
    try {
      // ------------------------------------------------------------------------
      // 【第二章：动手实践 - 给 QueryEngine 加个请求拦截器】
      // 可以在发给大模型前，强制注入自定义指令 (如：用中文回答并保持幽默)
      // ------------------------------------------------------------------------
      const myCustomPrompt = "\n\n【系统拦截器注入】：接下来的回复，请尽量使用中文，并用幽默的口吻！";
      const hackedUserMessage = userMessage + myCustomPrompt;

      // 1. 将用户的消息发送给大模型
      let response = await provider.sendMessage(hackedUserMessage, onTextResponse);

      let loopCount = 0;
      const maxLoops = 3; // 限制最大连续工具调用轮数，防止 AI 陷入死循环
      
      // ------------------------------------------------------------------------
      // 【第二章：大循环 (The Query Loop) 与它的“刹车机制”】
      // ------------------------------------------------------------------------
      // 机制一：自然完结 - 如果大模型没有返回 toolCalls，就不会进入/继续这个循环
      while (response.toolCalls && response.toolCalls.length > 0) {
        loopCount++;
        
        // 机制二：最大回合数限制 - 防止 AI 陷入死循环尝试 (对应 maxTurns)
        if (loopCount > maxLoops) {
          console.warn(`\n\x1b[33m[Agent] 工具调用循环次数过多 (${loopCount})，为防止无限循环，已强制终止 (强制停车！)。\x1b[0m`);
          break;
        }
        
        // 机制三：用户手动打断 - (可以通过 AbortController 监听 Ctrl+C 实现)
        if (abortSignal?.aborted) {
          console.warn(`\n\x1b[31m[Agent] 任务被用户手动打断 (aborted_tools)。\x1b[0m`);
          return; // 用户喊停，立刻退出
        }

        console.log(`\n\x1b[33m[Agent] 收到大模型指令，准备执行 ${response.toolCalls.length} 个工具调用... (第 ${loopCount} 轮)\x1b[0m`);
        
        // ------------------------------------------------------------------------
        // 【第二章：流式工具执行 (Streaming Tool Execution)】
        // 注：真正的 Claude Code 包含 StreamingToolExecutor，实现了“边看边做”。
        // 即大模型边生成参数 JSON，引擎边解析，拿到足够参数立刻执行，不等大模型说完！
        // 这里是简化版实现：等大模型全回复完再执行 handleToolCalls。
        // ------------------------------------------------------------------------
        const toolResults = await handleToolCalls(response.toolCalls);
        
        console.log(`\n\x1b[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\x1b[0m\n`);
        
        // ------------------------------------------------------------------------
        // 【第二章：容错与重试机制 (Fallback)】
        // 真实代码中此处会有 try-catch 包裹，如果发生 FallbackTriggeredError (如 API 限流)
        // 会切换到 fallbackModel 并重试循环
        // ------------------------------------------------------------------------
        
        // 3. 将工具执行的结果发回给大模型，获取下一步指示或最终文本回复
        response = await provider.sendToolResults(toolResults, onTextResponse);
      }
    } catch (error: any) {
      console.error(`\n[Agent 报错] ${error.message}`);
    }
  };

  return { chat };
}
