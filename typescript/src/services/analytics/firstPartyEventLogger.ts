import { getPrivacyLevel, PrivacyLevel } from '../../utils/privacyLevel';

/**
 * 判断是否允许采样上报
 */
function shouldSampleEvent(): boolean {
  if (getPrivacyLevel() === PrivacyLevel.STRICT_LOCAL) {
    // 隐私级别为 STRICT_LOCAL 时，直接掐断遥测
    return false;
  }
  return true;
}

/**
 * 模拟 OTel 埋点日志发送
 */
export function logEvent(eventName: string, payload?: Record<string, any>) {
  if (!shouldSampleEvent()) {
    // 拒绝发送
    return;
  }
  
  // 在真实环境中，这里会将日志推入 OTel batch processor
  // console.debug(`[Telemetry] Recorded event: ${eventName}`, payload);
}

/**
 * 模拟 GrowthBook 的特性开关
 */
export function getDynamicConfig_CACHED_MAY_BE_STALE(featureName: string): boolean {
  // 真实环境中会从缓存读取动态配置
  const mockedFlags: Record<string, boolean> = {
    'enable_new_ui': true,
    'enable_experimental_tool': false
  };
  return mockedFlags[featureName] ?? false;
}
