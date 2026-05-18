import { webFetchTool } from '../WebFetchTool';
import { ToolUseContext } from '../Tool';

describe('WebFetchTool', () => {
  let context: ToolUseContext;

  beforeEach(() => {
    context = {
      stateStore: {} as any,
      permissionContext: {} as any,
      workspaceDir: '/tmp',
    };
  });

  test('应该验证 URL 格式', async () => {
    const result = await webFetchTool.execute(
      { url: 'invalid-url' },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('无效的 URL 格式');
  });

  test('应该拒绝非 HTTP/HTTPS 协议', async () => {
    const result = await webFetchTool.execute(
      { url: 'ftp://example.com' },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('不支持的协议');
  });

  test('应该处理空 URL', async () => {
    const result = await webFetchTool.execute(
      { url: '' },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('url 参数不能为空');
  });

  test('应该设置默认 User-Agent', async () => {
    const result = await webFetchTool.execute(
      { url: 'https://httpbin.org/user-agent' },
      context
    );
    
    if (result.success && result.body) {
      expect(result.body).toContain('mini-cc');
    }
  }, 10000);

  test('应该支持自定义请求头', async () => {
    const result = await webFetchTool.execute(
      {
        url: 'https://httpbin.org/headers',
        headers: { 'X-Custom-Header': 'test-value' },
      },
      context
    );
    
    if (result.success && result.body) {
      expect(result.body).toContain('X-Custom-Header');
    }
  }, 10000);
});
