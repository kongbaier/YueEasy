import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '@/shared/lib/queryClient';
import { TooltipProvider } from '@/shared/ui/tooltip';

export const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delay={300}>{children}</TooltipProvider>
  </QueryClientProvider>
);
