import React from 'react';
import { render } from 'ink-testing-library';
import { ProgressBar } from '../components/ProgressBar';

const { act } = require('react-test-renderer');

describe('ProgressBar', () => {
  it('renders initial state correctly', () => {
    const { lastFrame } = render(<ProgressBar total={100} />);
    expect(lastFrame()).toContain('扫描进度:');
    expect(lastFrame()).toContain('0%');
  });

  it('renders complete state correctly', () => {
    // We render it and advance timers, or we can just test if we pass a small total.
    // Given the component has its own timer, we can use jest fake timers.
    jest.useFakeTimers();
    const { lastFrame } = render(<ProgressBar total={10} />);
    
    // Initially 0%
    expect(lastFrame()).toContain('0%');

    // Advance timers by 50ms * 20
    for (let i = 0; i < 20; i++) {
      act(() => {
        jest.advanceTimersByTime(50);
      });
    }

    // Now it should be 100%
    expect(lastFrame()).toContain('100%');
    expect(lastFrame()).toContain('██████████');
    
    jest.useRealTimers();
  });
});
