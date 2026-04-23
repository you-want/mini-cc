import React from 'react';
import { render } from 'ink-testing-library';
import { VirtualMessageList } from '../components/VirtualMessageList';

describe('VirtualMessageList', () => {
  it('renders a limited number of items to simulate virtual scrolling', () => {
    // Generate 100 messages
    const messages = Array.from({ length: 100 }).map((_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`
    }));

    const { lastFrame } = render(<VirtualMessageList messages={messages} columns={80} />);
    const frame = lastFrame() || '';
    
    // Should render the LAST few messages
    expect(frame).toContain('Message 85');
    expect(frame).toContain('Message 99');
    
    // Should NOT render messages out of the viewport
    expect(frame).not.toContain('Message 0');
    expect(frame).not.toContain('Message 84');
  });
});
