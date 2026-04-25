import { join } from 'path';
import * as os from 'os';

export interface BrowserPath {
  browser: string;
  path: string;
}

/**
 * 节选自 src/utils/claudeInChrome/setupPortable.ts
 * 获取跨平台的浏览器数据路径
 * 
 * 浏览器接管（Claude in Chrome）
 * 与桌面控制不同，浏览器接管已完美支持 Windows！
 * 在这里，工程师不仅支持了 macOS 和 Linux，甚至连 Windows 的各个 Chromium 内核浏览器路径都穷举了一遍。
 * 
 * @returns 浏览器配置目录路径数组
 */
export function getAllBrowserDataPathsPortable(): BrowserPath[] {
  const paths: BrowserPath[] = [];
  const home = os.homedir();
  const browserId = 'chrome'; // 这里为了简化，仅用 chrome 做示例
  
  const config = {
    windows: {
      path: ['Google', 'Chrome', 'User Data'],
      useRoaming: false
    }
  };

  switch (process.platform) {
    case 'win32': {
      if (config.windows.path.length > 0) {
        // 专门针对 Windows 的 AppData 目录结构进行了判断
        const appDataBase = config.windows.useRoaming
          ? join(home, 'AppData', 'Roaming')
          : join(home, 'AppData', 'Local');
        
        paths.push({
          browser: browserId,
          path: join(appDataBase, ...config.windows.path),
        });
      }
      break; // 真实源码使用 continue
    }
    case 'darwin': {
      // macOS 上的 Google Chrome 路径
      paths.push({
        browser: browserId,
        path: join(home, 'Library', 'Application Support', 'Google', 'Chrome')
      });
      break;
    }
    case 'linux': {
      // Linux 上的 Google Chrome 路径
      paths.push({
        browser: browserId,
        path: join(home, '.config', 'google-chrome')
      });
      break;
    }
  }
  
  return paths;
}
