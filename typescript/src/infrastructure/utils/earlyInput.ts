let capturedInput = '';
let isCapturing = false;

function onData(chunk: Buffer) {
  capturedInput += chunk.toString('utf-8');
}

export function startCapturingEarlyInput() {
  if (isCapturing) return;
  isCapturing = true;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.on('data', onData);
}

export function stopCapturingEarlyInput(): string {
  if (!isCapturing) return '';
  
  process.stdin.removeListener('data', onData);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
  
  isCapturing = false;
  const result = capturedInput;
  capturedInput = '';
  return result;
}
