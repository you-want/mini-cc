#!/usr/bin/env node

// @ts-ignore - 修复 Bun 打包后 yoga-layout-prebuilt 报错 ReferenceError: _a is not defined
global._a = undefined;

// 屏蔽 Node.js 21+ 关于 punycode 的弃用警告
// 这样可以避免破坏命令行交互界面的视觉效果
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

import { profileCheckpoint } from './utils/startupProfiler';

profileCheckpoint('cli_tsx_entry');

// 获取命令行参数
const args = process.argv.slice(2);

// 获取真实的版本号
const pkg = require('../package.json');
const version = pkg.version;

// 【Fast-path 极速通道检查】
// 这里的关键是不进行任何庞大的 `import` 操作，直接处理无需复杂逻辑的命令。
// 这保证了像 `--version` 或 `--health` 这样的命令能实现“秒开”，0延迟。
if (args.length > 0) {
  const cmd = args[0];
  if (cmd === '--version' || cmd === '-v') {
    console.log(`mini-cc v${version} (Fast-path)`);
    process.exit(0);
  }
  if (cmd === '--help' || cmd === '-h') {
    console.log('Usage: mini-cc [options]');
    console.log('Options:');
    console.log('  -v, --version  Show version');
    console.log('  -h, --help     Show help');
    console.log('  --health       Health check');
    console.log('  --profile      Dump startup performance profile');
    process.exit(0);
  }
  if (cmd === '--health') {
    console.log('OK (Fast-path)');
    process.exit(0);
  }
}

// 【防吞键机制：早期输入捕获】
// 因为后续加载 `main.ts` 和依赖可能需要几百毫秒。
// 如果用户手快，在这期间敲击了键盘，就会被系统丢弃（吞键）。
// 所以我们提前接管 stdin，将按键缓存起来。
import { startCapturingEarlyInput } from './infrastructure/utils/earlyInput';
startCapturingEarlyInput();

// 【并行预加载模式 (Parallel Pre-fetching)】
// 在加载几十 MB 的重度依赖（如大模型 SDK、React等）之前，先把耗时的异步 I/O 任务抛到后台。
const prefetchConfig = async () => {
  // 在真实应用中，这可能是从 AWS 读取密钥，或者解析全局配置文件。
  // 这里我们模拟 300ms 的延迟，用来演示早期输入捕获的作用。
  await new Promise(resolve => setTimeout(resolve, 300));
  return { configLoaded: true };
};

// 立即触发 I/O 请求，不使用 await 阻塞主线程
const prefetchPromise = prefetchConfig();

profileCheckpoint('main_tsx_imports_starting');

// 【动态加载主模块】
// 此时 Node.js 主线程开始解析庞大的依赖树，而底层的 libuv 线程池正在处理上面的 prefetchConfig I/O。
// 两者并行进行，大大缩短了冷启动时间！
import('./main')
  .then(async (mainModule) => {
    profileCheckpoint('main_tsx_imports_loaded');
    
    // 等主模块代码加载完成时，再等待预加载 I/O 任务的结果（可能早就完成了）
    const config = await prefetchPromise;
    profileCheckpoint('prefetch_config_ready');
    
    // 启动主应用
    mainModule.startApp(config);
  })
  .catch((err) => {
    console.error('Failed to load main module:', err);
    process.exit(1);
  });
