import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * 模拟的 execFileNoThrow，用于执行命令但不抛出异常
 * 封装 child_process.execFile 以保证兼容性和容错
 */
async function execFileNoThrow(command: string, args: string[], options: any) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, options);
    return { stdout, stderr, code: 0 };
  } catch (error: any) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code || 1 };
  }
}

export interface ComputerExecutor {
  readClipboard: () => Promise<string>;
}

/**
 * 节选自 src/utils/computerUse/executor.ts
 * 
 * 桌面控制（Computer Use）：鼠标、键盘与截屏
 * 通过原生的 pbpaste 命令读取剪贴板内容。
 * 
 * 这里没有依赖庞大的 Electron 模块，而是直接调用了 macOS 的 pbpaste，非常轻量硬核。
 */
export async function readClipboardViaPbpaste(): Promise<string> {
  const { stdout, code } = await execFileNoThrow('pbpaste', [], {
    useCwd: false,
  });
  if (code !== 0) {
    throw new Error(`pbpaste exited with code ${code}`);
  }
  return stdout;
}

/**
 * 创建桌面控制执行器
 * 
 * 为什么目前不支持 Windows？
 * 桌面控制目前被强行锁死在了 macOS，暂时不支持 Windows。
 * 因为底层的智能截屏与窗口管理（Terminal as Surrogate Host）
 * 深度依赖了 macOS 原生的 SCContentFilter 和 NSWorkspace API。
 * 
 * @param opts 选项参数（预留）
 * @returns ComputerExecutor 实例
 */
export function createCliExecutor(opts?: any): ComputerExecutor {
  if (process.platform !== 'darwin') { // 'darwin' 即 macOS
    throw new Error(
      `createCliExecutor called on ${process.platform}. Computer control is macOS-only.`
    );
  }
  
  return {
    readClipboard: readClipboardViaPbpaste
  };
}
