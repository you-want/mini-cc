import React from 'react';
import { render } from 'ink-testing-library';
import { CommandSuggestions, CommandSuggestion } from '../components/CommandSuggestions';

describe('CommandSuggestions', () => {
  const mockSuggestions: CommandSuggestion[] = [
    { command: '/help', description: '显示帮助信息', category: 'system' },
    { command: '/clear', description: '清空对话历史', category: 'system' },
    { command: '/skill remember', description: '记忆管理', category: 'skill', fullCommand: '/skill remember' },
    { command: '/skill verify', description: '代码验证', category: 'skill', fullCommand: '/skill verify' },
  ];

  it('should not render when visible is false', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={mockSuggestions} selectedIndex={0} visible={false} />
    );
    
    expect(lastFrame()).toBe('');
  });

  it('should not render when suggestions array is empty', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={[]} selectedIndex={0} visible={true} />
    );
    
    expect(lastFrame()).toBe('');
  });

  it('should render suggestions when visible is true', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={mockSuggestions} selectedIndex={0} visible={true} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('可用命令');
    expect(frame).toContain('/help');
    expect(frame).toContain('/clear');
  });

  it('should display category labels', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={mockSuggestions} selectedIndex={0} visible={true} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('系统');
    expect(frame).toContain('技能');
  });

  it('should display command descriptions', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={mockSuggestions} selectedIndex={0} visible={true} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('显示帮助信息');
    expect(frame).toContain('清空对话历史');
  });

  it('should show scroll indicators when there are more than 10 items', () => {
    const manySuggestions: CommandSuggestion[] = Array.from({ length: 20 }, (_, i) => ({
      command: `/cmd${i}`,
      description: `Command ${i}`,
      category: 'system' as const,
    }));

    const { lastFrame } = render(
      <CommandSuggestions suggestions={manySuggestions} selectedIndex={0} visible={true} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('还有');
    expect(frame).toContain('个命令在下方');
  });

  it('should display keyboard navigation hints', () => {
    const { lastFrame } = render(
      <CommandSuggestions suggestions={mockSuggestions} selectedIndex={0} visible={true} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('↑↓ 选择');
    expect(frame).toContain('Tab/Enter 确认');
    expect(frame).toContain('Esc 取消');
  });
});
