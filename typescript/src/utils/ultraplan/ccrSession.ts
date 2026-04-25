/**
 * 代表与 CCR (Claude Code Remote) 云端交互的消息类型
 */
export interface SDKMessage {
  type: string;
  name?: string;
  plan?: string;
  id?: string;
  subtype?: string;
}

/**
 * 节选自 src/utils/ultraplan/ccrSession.ts
 * 解析云端返回的事件流的结果
 */
export type ScanResult =
  | { kind: 'approved'; plan: string }
  | { kind: 'teleport'; plan: string }
  | { kind: 'rejected'; id: string }
  | { kind: 'pending' }
  | { kind: 'terminated'; subtype: string }
  | { kind: 'unchanged' };

/**
 * 神秘的魔法字符串（Sentinel）
 * 当你在浏览器的云端任务界面点击“传送回终端执行”时，云端会将这个标记连同制定好的计划一起发回本地。
 * CLI 接收到后，就会像拿到剧本一样，开始在你的本地机器上飞速敲代码！
 */
export const __ULTRAPLAN_TELEPORT_LOCAL__ = '__ULTRAPLAN_TELEPORT_LOCAL__';

/**
 * ExitPlanModeScanner
 * 纯状态分类器，用于解析 CCR 事件流
 * 
 * 大模型在本地终端里跑，受限于 Token 窗口，遇到极其复杂的架构重构任务怎么办？
 * 系统会将任务打包，传送到云端多智能体环境中执行。
 * 这个类负责不断地拉取云端的执行事件，直到获取到一个被批准的最终执行计划（Exit Plan）。
 */
export class ExitPlanModeScanner {
  /**
   * 遍历云端返回的事件，寻找 EXIT_PLAN_MODE_V2_TOOL_NAME 相关的工具调用
   * 
   * @param newEvents 从云端轮询获取的最新事件流
   * @returns ScanResult 解析结果
   */
  ingest(newEvents: SDKMessage[]): ScanResult {
    for (const event of newEvents) {
      if (event.type === 'tool_use' && event.name === 'EXIT_PLAN_MODE_V2_TOOL_NAME') {
        // 如果包含传送门标记，触发 teleport (传送回本地执行)
        if (event.plan && event.plan.includes(__ULTRAPLAN_TELEPORT_LOCAL__)) {
          return { kind: 'teleport', plan: event.plan };
        }
        // 否则仅作为普通的批准执行计划
        return { kind: 'approved', plan: event.plan || '' };
      }
      
      if (event.type === 'tool_use_rejected') {
        return { kind: 'rejected', id: event.id || '' };
      }
      
      if (event.type === 'session_terminated') {
        return { kind: 'terminated', subtype: event.subtype || 'unknown' };
      }
    }
    
    // 如果有新事件但不满足上述结束条件，则处于等待中
    if (newEvents.length > 0) {
      return { kind: 'pending' };
    }
    
    // 没有新事件，状态未改变
    return { kind: 'unchanged' };
  }
}
