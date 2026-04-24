export const startupCheckpoints: Array<{ name: string; time: number }> = [];
const startTime = performance.now();

export function profileCheckpoint(name: string) {
  startupCheckpoints.push({ name, time: performance.now() });
}

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
