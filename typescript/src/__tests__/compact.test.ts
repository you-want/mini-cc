/**
 * Compact 模块单元测试
 */

import {
  stripImagesFromMessages,
  truncateHeadForPTLRetry,
  type Message,
} from '../services/compact/compact';
import { groupMessagesByApiRound, type Message as GroupedMessage } from '../services/compact/grouping';
import {
  getCompactPrompt,
  getPartialCompactPrompt,
  getCompactUserSummaryMessage,
} from '../services/compact/prompt';

describe('Compact 模块', () => {
  describe('stripImagesFromMessages', () => {
    it('应该将图片块替换为占位符', () => {
      const messages: Message[] = [
        {
          type: 'user',
          content: [
            { type: 'image', source: { data: 'base64...' } },
            { type: 'text', text: '描述图片' },
          ],
        },
      ];
      const result = stripImagesFromMessages(messages);
      expect(result[0].content).toContainEqual({ type: 'text', text: '[image]' });
    });

    it('应该将文档块替换为占位符', () => {
      const messages: Message[] = [
        {
          type: 'user',
          content: [
            { type: 'document', source: { data: 'pdf...' } },
            { type: 'text', text: '描述文档' },
          ],
        },
      ];
      const result = stripImagesFromMessages(messages);
      expect(result[0].content).toContainEqual({ type: 'text', text: '[document]' });
    });

    it('应该保留非媒体内容不变', () => {
      const messages: Message[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: '普通文本消息' }],
        },
      ];
      const result = stripImagesFromMessages(messages);
      expect(result[0]).toEqual(messages[0]);
    });

    it('应该处理非 user 角色的消息', () => {
      const messages: Message[] = [
        {
          type: 'assistant',
          content: [{ type: 'image', source: { data: 'base64...' } }],
        },
      ];
      const result = stripImagesFromMessages(messages);
      expect(result[0]).toEqual(messages[0]);
    });
  });

  describe('truncateHeadForPTLRetry', () => {
    it('应该丢弃头部消息', () => {
      const messages: Message[] = [
        { type: 'system', content: 'System' },
        { type: 'user', content: 'First' },
        { type: 'assistant', content: 'Response1' },
        { type: 'user', content: 'Second' },
      ];
      const result = truncateHeadForPTLRetry(messages, { error: { message: 'maximum context length exceeded by 1000 tokens' } });
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThan(messages.length);
    });

    it('应该保留至少一条消息', () => {
      const messages: Message[] = [
        { type: 'user', content: 'First' },
        { type: 'assistant', content: 'Response' },
      ];
      const result = truncateHeadForPTLRetry(messages, { error: { message: 'maximum context length exceeded' } });
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });

    it('应该返回 null 当消息太少', () => {
      const messages: Message[] = [{ type: 'user', content: 'Only one' }];
      const result = truncateHeadForPTLRetry(messages, { error: { message: 'maximum context length exceeded' } });
      expect(result).toBeNull();
    });
  });

  describe('groupMessagesByApiRound', () => {
    it('应该按用户消息分组', () => {
      const messages: GroupedMessage[] = [
        { type: 'user', content: 'First question' },
        { type: 'assistant', content: 'First response' },
        { type: 'user', content: 'Second question' },
        { type: 'assistant', content: 'Second response' },
      ];
      const groups = groupMessagesByApiRound(messages);
      expect(groups.length).toBe(2);
      expect(groups[0][0].content).toBe('First question');
      expect(groups[1][0].content).toBe('Second question');
    });

    it('应该处理单个消息', () => {
      const messages: GroupedMessage[] = [
        { type: 'user', content: 'Single question' },
      ];
      const groups = groupMessagesByApiRound(messages);
      expect(groups.length).toBe(1);
    });

    it('应该保留系统消息', () => {
      const messages: GroupedMessage[] = [
        { type: 'system', content: 'System prompt' },
        { type: 'user', content: 'Question' },
        { type: 'assistant', content: 'Response' },
      ];
      const groups = groupMessagesByApiRound(messages);
      expect(groups.length).toBe(1);
      expect(groups[0][0].content).toBe('System prompt');
    });
  });

  describe('getCompactPrompt', () => {
    it('应该返回基础提示词', () => {
      const prompt = getCompactPrompt();
      expect(prompt).toContain('summary');
      expect(prompt).toContain('conversation');
    });

    it('应该包含自定义指令', () => {
      const prompt = getCompactPrompt('重点关注技术细节');
      expect(prompt).toContain('重点关注技术细节');
    });
  });

  describe('getPartialCompactPrompt', () => {
    it('应该支持 from 方向', () => {
      const prompt = getPartialCompactPrompt(undefined, 'from');
      expect(prompt).toContain('after the selected point');
    });

    it('应该支持 up_to 方向', () => {
      const prompt = getPartialCompactPrompt(undefined, 'up_to');
      expect(prompt).toContain('before the selected point');
    });

    it('应该包含自定义指令', () => {
      const prompt = getPartialCompactPrompt('关注错误信息');
      expect(prompt).toContain('关注错误信息');
    });
  });

  describe('getCompactUserSummaryMessage', () => {
    it('应该格式化总结消息', () => {
      const message = getCompactUserSummaryMessage('测试总结内容', false);
      expect(message).toContain('测试总结内容');
      expect(message).toContain('[Conversation Summary]');
    });

    it('应该包含会话记录路径', () => {
      const message = getCompactUserSummaryMessage('总结', false, '/path/to/transcript');
      expect(message).toContain('/path/to/transcript');
    });

    it('应该抑制后续问题', () => {
      const message = getCompactUserSummaryMessage('总结', true);
      expect(message).not.toContain('continue the conversation');
    });
  });
});