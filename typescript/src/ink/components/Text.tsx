import { Text as InkText, TextProps } from 'ink';
import React, { PropsWithChildren } from 'react';

export function Text(props: PropsWithChildren<TextProps>) {
  return <InkText {...props} />;
}
