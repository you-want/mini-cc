/**
 * Verify 技能
 * 
 * 功能：验证代码质量，检查常见问题
 * 
 * 使用场景：
 * - 代码审查
 * - 提交前检查
 * - 重构后验证
 * 
 * 教学要点：
 * 1. 代码质量：好的代码需要经过验证
 * 2. 自动化检查：减少人工审查的工作量
 * 3. 最佳实践：遵循行业标准和团队规范
 */

import { Skill } from '../types';

export default {
  name: 'verify',
  displayName: '代码验证',
  description: '验证代码质量，检查类型错误、linter 问题、测试覆盖率等',
  category: 'code',
  prompt: `你是一个代码质量验证助手。当用户要求验证代码时，你需要：

1. 编译检查
   - 运行 TypeScript 编译器检查类型错误
   - 使用 BashTool 执行: npm run build 或 tsc --noEmit

2. Linter 检查
   - 运行 ESLint 检查代码规范
   - 使用 BashTool 执行: npm run lint 或 eslint .

3. 测试检查
   - 运行测试套件
   - 使用 BashTool 执行: npm test

4. 代码审查
   - 使用 GrepTool 搜索常见问题模式：
     * console.log（生产代码中的调试语句）
     * TODO/FIXME（未完成的工作）
     * any 类型（TypeScript 类型安全问题）
     * 硬编码的密钥或敏感信息

5. 生成报告
   - 总结发现的问题
   - 按严重程度分类
   - 提供修复建议

请按顺序执行这些检查，并生成详细的验证报告。`,
  examples: [
    '请验证当前项目的代码质量',
    '检查 src 目录下的代码是否有问题',
    '运行完整的代码验证流程',
  ],
  tags: ['code-quality', 'testing', 'linting', 'verification'],
} as Skill;
