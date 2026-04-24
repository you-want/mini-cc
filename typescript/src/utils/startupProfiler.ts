/**
 * 用于记录应用启动各个阶段的性能探针数据
 * 通过分析这些节点，可以帮助定位冷启动的性能瓶颈
 */
export const startupCheckpoints: Array<{ name: string; time: number }> = [];

// 记录应用开始执行的初始时间戳
const startTime = performance.now();

/**
 * 在应用启动的关键位置打点记录当前时间
 * @param name 探针的名称，用于标识当前的启动阶段（例如：'startApp_entry'）
 */
export function profileCheckpoint(name: string) {
  startupCheckpoints.push({ name, time: performance.now() });
}

/**
 * 输出完整的启动性能分析报告
 * 计算并打印每个阶段的耗时（与上一节点的差值）以及总耗时
 * 通常在传入 --profile 参数时被调用
 */
export function dumpStartupProfile() {
  if (startupCheckpoints.length === 0) {
    console.log('[Profiler] No checkpoints recorded.');
    return;
  }
  const table = startupCheckpoints.map((c, i) => {
    const delta = i === 0 ? c.time - startTime : c.time - startupCheckpoints[i - 1].time;
    return `[${c.name}] 耗时: ${delta.toFixed(2)}ms | 总计: ${(c.time - startTime).toFixed(2)}ms`;
  });
  console.log('\n=== Startup Profile ===');
  console.log(table.join('\n'));
  console.log('=======================\n');
}
