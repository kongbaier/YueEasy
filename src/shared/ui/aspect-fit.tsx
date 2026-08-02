import React from 'react';
import { cn } from '../lib/utils';

interface AspectFitProps extends React.ComponentProps<'div'> {
  ratio: number;
}

export const AspectFit = ({
  ratio,
  children,
  className,
  ...props
}: AspectFitProps) => {
  return (
    <div
      className={cn(
        'size-full flex items-center justify-center @container-size',
        className,
      )}
      {...props}
    >
      <div
        style={{
          width: `min(100cqw,calc(100cqh * ${ratio}))`,
          height: `min(100cqh,calc(100cqw * ${1 / ratio}))`,
          aspectRatio: ratio,
        }}
      >
        {children}
      </div>
    </div>
  );
};
