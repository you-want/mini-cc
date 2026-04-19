// 用于缓存在系统启动期间用户提前输入的字符
let capturedInput = '';
let isCapturing = false;

/**
 * 处理标准输入流的数据块
 */
function onData(chunk: Buffer) {
  capturedInput += chunk.toString('utf-8');
}

/**
 * 开启早期输入捕获 (Early Input Capture)
 * 
 * 这是一个体验优化机制：在应用启动、加载模块或进行初始网络请求时，
 * 用户可能已经开始敲击键盘。如果不捕获这些输入，它们可能会丢失（被吞掉）。
 * 通过监听 stdin 的原始数据流，我们可以在应用完全就绪前缓存这些按键。
 */
export function startCapturingEarlyInput() {
  if (isCapturing) return;
  isCapturing = true;

  // 开启原始模式 (Raw Mode)，绕过操作系统的行缓冲和回显，直接读取按键
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume(); // 恢复流以开始接收数据
  process.stdin.on('data', onData);
}

/**
 * 停止早期输入捕获并返回缓存的输入字符串
 * 
 * 当应用的主交互界面（如 Readline REPL）就绪后调用此函数。
 * 返回的字符串可以预填充到交互提示符中，无缝衔接用户的打字体验。
 */
export function stopCapturingEarlyInput(): string {
  if (!isCapturing) return '';
  
  // 移除监听器
  process.stdin.removeListener('data', onData);
  
  // 恢复终端的正常模式
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause(); // 暂停流（如果后续使用 readline，它会自动再次 resume）
  
  isCapturing = false;
  
  // 提取并清空缓存
  const result = capturedInput;
  capturedInput = '';
  return result;
}
