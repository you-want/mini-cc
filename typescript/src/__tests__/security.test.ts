import { checkCommandSecurity } from '../infrastructure/tools/BashTool/bashSecurity';
import { checkDestructiveCommand } from '../infrastructure/tools/BashTool/destructiveCommandWarning';
import { stripCommandWrappers, shouldUseSandbox } from '../infrastructure/tools/BashTool/shouldUseSandbox';
import { triggerVoiceMode } from '../commands/voice';

describe('BashTool 安全沙盒与指令拦截测试', () => {
  
  describe('bashSecurity.ts - 命令替换与高危指令拦截', () => {
    it('应该拦截隐蔽的命令替换语法', () => {
      const payloads = [
        'echo <(ls)',           // process substitution <()
        'cat >(grep foo)',      // process substitution >()
        'ls =curl',             // Zsh equals expansion (=cmd)
        'echo `cat /etc/passwd`', // backtick
        'echo <# PowerShell'    // PowerShell comment
      ];

      for (const payload of payloads) {
        const result = checkCommandSecurity(payload);
        expect(result.isSafe).toBe(false);
        expect(result.reason).toContain('安全沙盒拦截：禁止使用命令替换语法以防越权注入');
      }
      
      // $(rm -rf /) 这个会先匹配上危险命令 rm -rf /，所以原因会是高危指令模式
      const result2 = checkCommandSecurity('echo $(rm -rf /)');
      expect(result2.isSafe).toBe(false);
      expect(result2.reason).toContain('安全沙盒拦截');
    });

    it('应该拦截高危 Zsh 模块调用', () => {
      const payloads = [
        'zmodload zsh/net/socket',
        'sysopen /etc/passwd',
        'zpty mypty /bin/bash'
      ];

      for (const payload of payloads) {
        const result = checkCommandSecurity(payload);
        expect(result.isSafe).toBe(false);
        expect(result.reason).toContain('安全沙盒拦截：禁止调用高危 Shell 模块');
      }
      
      // zf_rm -rf / 会先匹配危险命令 rm -rf /
      const result2 = checkCommandSecurity('zf_rm -rf /');
      expect(result2.isSafe).toBe(false);
      expect(result2.reason).toContain('安全沙盒拦截');
    });

    it('应该放行正常命令', () => {
      const result = checkCommandSecurity('npm run build');
      expect(result.isSafe).toBe(true);
    });
  });

  describe('destructiveCommandWarning.ts - 破坏性指令预警', () => {
    it('应该匹配并警告破坏性命令', () => {
      const cases = [
        { cmd: 'git reset --hard HEAD~1', expected: 'Note: may discard uncommitted changes' },
        { cmd: 'git push origin main --force', expected: 'Note: may overwrite remote history' },
        { cmd: 'rm -rf /some/dir', expected: 'Note: may recursively force-remove files' },
        { cmd: 'rm -fr /some/dir', expected: 'Note: may recursively force-remove files' },
        { cmd: 'DROP TABLE users;', expected: 'Note: may drop or truncate database objects' },
        { cmd: 'kubectl delete pod my-pod', expected: 'Note: may delete Kubernetes resources' },
        { cmd: 'terraform destroy', expected: 'Note: may destroy Terraform infrastructure' }
      ];

      for (const testCase of cases) {
        const warning = checkDestructiveCommand(testCase.cmd);
        expect(warning).toBe(testCase.expected);
      }
    });

    it('对于安全的命令不应发出预警', () => {
      expect(checkDestructiveCommand('git status')).toBeNull();
      expect(checkDestructiveCommand('ls -la')).toBeNull();
      expect(checkDestructiveCommand('SELECT * FROM users')).toBeNull();
    });
  });

  describe('shouldUseSandbox.ts - 沙盒包裹逻辑', () => {
    it('应该正确剥离环境变量和包装器', () => {
      expect(stripCommandWrappers('FOO=bar bazel run')).toBe('bazel');
      expect(stripCommandWrappers('FOO="bar baz" nice sudo make')).toBe('make');
      expect(stripCommandWrappers('timeout 30 watch curl http://example.com')).toBe('curl');
      expect(stripCommandWrappers('ENV_VAR=1 sudo nohup docker ps')).toBe('docker');
    });

    it('应该正确判断是否需要沙盒', () => {
      // 纯白名单命令，不需要沙盒
      expect(shouldUseSandbox('ls -la')).toBe(false);
      expect(shouldUseSandbox('pwd && whoami')).toBe(false);

      // 包含非白名单命令，需要沙盒
      expect(shouldUseSandbox('docker ps')).toBe(true);
      expect(shouldUseSandbox('echo hello && curl http://evil.com')).toBe(true);
      expect(shouldUseSandbox('FOO=bar bazel test')).toBe(true);
    });
  });

  describe('Voice Mode 语音模式', () => {
    it('触发 /voice 时应返回正确的初始化字符串', async () => {
      const response = await triggerVoiceMode();
      expect(response).toContain('Voice mode enabled. Hold Space to record.');
    });
  });
});
