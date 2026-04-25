import { createCliExecutor } from '../architecture-mocks/computerUse/executor';
import { getChromeBridgeUrl } from '../architecture-mocks/claudeInChrome/mcpServer';
import { getAllBrowserDataPathsPortable } from '../architecture-mocks/claudeInChrome/setupPortable';
import { ExitPlanModeScanner, __ULTRAPLAN_TELEPORT_LOCAL__ } from '../architecture-mocks/ultraplan/ccrSession';
import * as os from 'os';

describe('Ultimate Agent Capabilities (Chapter 10)', () => {

  describe('1. Desktop Control (Computer Use)', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should throw error on non-darwin platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      // 在非 macOS 系统（如 Windows win32）上应报错，因为截屏模块不支持跨平台
      expect(() => createCliExecutor()).toThrow(/Computer control is macOS-only/);
    });

    it('should create executor on darwin platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });
      // 只有 darwin (macOS) 下才能正常创建执行器
      const executor = createCliExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor.readClipboard).toBe('function');
    });
  });

  describe('2. Browser Takeover (Claude in Chrome)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return undefined if bridge is not enabled', () => {
      process.env.USER_TYPE = 'regular';
      // 如果没有开启桥接特性，则返回 undefined
      expect(getChromeBridgeUrl()).toBeUndefined();
    });

    it('should return local wss url if LOCAL_BRIDGE is set', () => {
      process.env.USER_TYPE = 'ant'; // ant 员工默认开启
      process.env.LOCAL_BRIDGE = '1';
      // 开启本地桥接测试，连接到 localhost
      expect(getChromeBridgeUrl()).toBe('ws://localhost:8765');
    });

    it('should return production bridge url by default', () => {
      process.env.USER_TYPE = 'ant';
      delete process.env.LOCAL_BRIDGE;
      // 默认连接到远端 bridge.claudeusercontent.com
      expect(getChromeBridgeUrl()).toBe('wss://bridge.claudeusercontent.com');
    });

    it('should resolve cross-platform browser data paths including Windows', () => {
      const originalPlatform = process.platform;
      
      // 测试 Windows 的 AppData 路径提取
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      const paths = getAllBrowserDataPathsPortable();
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].path).toContain('AppData');

      // 还原 platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('3. Cloud Brain Relay (Ultraplan CCR)', () => {
    it('should parse teleport plan correctly with sentinel string', () => {
      const scanner = new ExitPlanModeScanner();
      
      // 模拟云端下发的包含魔法传送字符串的工具调用事件
      const events = [
        {
          type: 'tool_use',
          name: 'EXIT_PLAN_MODE_V2_TOOL_NAME',
          plan: `Step 1\n${__ULTRAPLAN_TELEPORT_LOCAL__}\nStep 2`
        }
      ];
      
      const result = scanner.ingest(events);
      
      // 应该识别为 teleport (传送本地执行) 状态
      expect(result.kind).toBe('teleport');
      if (result.kind === 'teleport') {
        expect(result.plan).toContain(__ULTRAPLAN_TELEPORT_LOCAL__);
      }
    });

    it('should return unchanged if no events', () => {
      const scanner = new ExitPlanModeScanner();
      const result = scanner.ingest([]);
      expect(result.kind).toBe('unchanged');
    });

    it('should handle tool use rejection', () => {
      const scanner = new ExitPlanModeScanner();
      const events = [
        {
          type: 'tool_use_rejected',
          id: 'tool_123'
        }
      ];
      const result = scanner.ingest(events);
      expect(result.kind).toBe('rejected');
      if (result.kind === 'rejected') {
        expect(result.id).toBe('tool_123');
      }
    });
  });

});
