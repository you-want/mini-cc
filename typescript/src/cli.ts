#!/usr/bin/env node

// 屏蔽 Node.js 21+ 关于 punycode 的弃用警告
const originalEmit = process.emit;
// @ts-ignore
process.emit = function (name: string, data: any, ...args: any[]) {
  if (
    name === 'warning' &&
    typeof data === 'object' &&
    data.name === 'DeprecationWarning' &&
    data.message.includes('punycode')
  ) {
    return false;
  }
  // @ts-ignore
  return originalEmit.apply(process, [name, data, ...args]);
};

// Fast-path checking
const args = process.argv.slice(2);

// Check if we hit a fast-path that doesn't need heavy imports
if (args.length > 0) {
  const cmd = args[0];
  if (cmd === '--version' || cmd === '-v') {
    console.log('mini-cc v1.0.0 (Fast-path)');
    process.exit(0);
  }
  if (cmd === '--help' || cmd === '-h') {
    console.log('Usage: mini-cc [options]');
    console.log('Options:');
    console.log('  -v, --version  Show version');
    console.log('  -h, --help     Show help');
    console.log('  --health       Health check');
    process.exit(0);
  }
  if (cmd === '--health') {
    console.log('OK (Fast-path)');
    process.exit(0);
  }
}

// 提前把用户的键盘输入存起来，防止卡顿时吞键
import { startCapturingEarlyInput } from './infrastructure/utils/earlyInput';
startCapturingEarlyInput();

// Parallel Pre-fetching pattern implementation
// Kick off async tasks before loading heavy modules
const prefetchConfig = async () => {
  // In a real app, this could be fetching AWS secrets or parsing global configs
  // Simulate delay to show early input capturing usefulness
  await new Promise(resolve => setTimeout(resolve, 300));
  return { configLoaded: true };
};

const prefetchPromise = prefetchConfig();

// Dynamically import the heavy main module
// This delays parsing and evaluating large dependencies until we are sure we need them
import('./main')
  .then(async (mainModule) => {
    // Wait for the parallel pre-fetch to finish before continuing
    const config = await prefetchPromise;
    mainModule.startApp(config);
  })
  .catch((err) => {
    console.error('Failed to load main module:', err);
    process.exit(1);
  });
