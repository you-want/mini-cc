/**
 * 节选自 src/utils/claudeInChrome/mcpServer.ts
 * 
 * 模拟的一个缓存获取函数
 */
function getFeatureValue_CACHED_MAY_BE_STALE(featureName: string, defaultValue: boolean): boolean {
  return defaultValue;
}

/**
 * 判断环境变量是否为 Truthy (1 或 true)
 */
function isEnvTruthy(val?: string): boolean {
  return val === '1' || val === 'true';
}

/**
 * 获取 Chrome Bridge 的 WebSocket URL
 * 
 * 官方在这里利用 MCP（Model Context Protocol）协议，搭建了一个桥接服务。
 * 它的作用是让 CLI 工具能够直接与你浏览器里的 Claude for Chrome 插件进行实时通信。
 * 这个桥接不仅支持通过 WebSocket 连接到官方的 Bridge 服务器，还支持本地连接。
 * 
 * @returns 桥接服务器的 WebSocket URL
 */
export function getChromeBridgeUrl(): string | undefined {
  // 仅对 ant 员工或启用了 tengu_copper_bridge 特性开关的用户开启
  const bridgeEnabled =
    process.env.USER_TYPE === 'ant' ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_bridge', false);

  if (!bridgeEnabled) {
    return undefined;
  }

  // 如果启用了本地调试，则连接到本地的桥接服务
  if (
    isEnvTruthy(process.env.USE_LOCAL_OAUTH) ||
    isEnvTruthy(process.env.LOCAL_BRIDGE)
  ) {
    return 'ws://localhost:8765';
  }
  
  // 否则连接到生产环境的桥接服务器
  return 'wss://bridge.claudeusercontent.com';
}
