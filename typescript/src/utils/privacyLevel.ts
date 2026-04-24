/**
 * 定义隐私分级
 */
export enum PrivacyLevel {
  /** 允许收集和发送遥测数据 */
  ALLOW_TELEMETRY = 'ALLOW_TELEMETRY',
  /** 拒绝发送任何遥测数据 */
  STRICT_LOCAL = 'STRICT_LOCAL'
}

/**
 * 获取当前隐私级别配置
 * 在真实环境中，这个配置可能来自于全局配置文件 ~/.mini-cc/settings.json
 */
export function getPrivacyLevel(): PrivacyLevel {
  // 可以通过环境变量强行关闭遥测
  if (process.env.MINI_CC_TELEMETRY === '0' || process.env.MINI_CC_TELEMETRY === 'false') {
    return PrivacyLevel.STRICT_LOCAL;
  }
  return PrivacyLevel.ALLOW_TELEMETRY;
}
