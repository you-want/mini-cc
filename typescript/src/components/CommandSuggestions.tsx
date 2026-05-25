import React from 'react';
import { Box } from '../ink/components/Box';
import { Text } from '../ink/components/Text';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'skill' | 'system' | 'custom';
  fullCommand?: string;
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  selectedIndex: number;
  visible: boolean;
}

export function CommandSuggestions({ suggestions, selectedIndex, visible }: CommandSuggestionsProps) {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  const categoryColors: Record<string, string> = {
    skill: 'cyan',
    system: 'yellow',
    custom: 'magenta',
  };

  const categoryLabels: Record<string, string> = {
    skill: '技能',
    system: '系统',
    custom: '自定义',
  };

  const maxVisibleItems = 10;
  const totalItems = suggestions.length;
  
  let startIndex = 0;
  let endIndex = Math.min(maxVisibleItems, totalItems);
  
  if (selectedIndex >= maxVisibleItems) {
    startIndex = selectedIndex - maxVisibleItems + 1;
    endIndex = selectedIndex + 1;
  }
  
  const visibleSuggestions = suggestions.slice(startIndex, endIndex);
  const hasMore = endIndex < totalItems;
  const hasPrevious = startIndex > 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>可用命令 (↑↓ 选择, Tab/Enter 确认, Esc 取消)</Text>
      </Box>
      {hasPrevious && (
        <Box>
          <Text color="dim">... 还有 {startIndex} 个命令在上方</Text>
        </Box>
      )}
      {visibleSuggestions.map((suggestion, index) => {
        const actualIndex = startIndex + index;
        const isSelected = actualIndex === selectedIndex;
        
        return (
          <Box key={suggestion.command}>
            <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
              {isSelected ? '> ' : '  '}
              <Text color={categoryColors[suggestion.category]}>
                [{categoryLabels[suggestion.category]}]
              </Text>
              {' '}
              {suggestion.command}
              {' - '}
              <Text color="gray">{suggestion.description}</Text>
            </Text>
          </Box>
        );
      })}
      {hasMore && (
        <Box marginTop={1}>
          <Text color="dim">... 还有 {totalItems - endIndex} 个命令在下方</Text>
        </Box>
      )}
    </Box>
  );
}
