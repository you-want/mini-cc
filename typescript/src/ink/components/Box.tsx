import { Box as InkBox, BoxProps } from 'ink';
import React, { PropsWithChildren } from 'react';

export function Box(props: PropsWithChildren<BoxProps>) {
  return <InkBox {...props} />;
}
