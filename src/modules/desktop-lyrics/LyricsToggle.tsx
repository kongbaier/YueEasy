import { Button } from '@/shared/ui/button';
import { cn } from 'cn';
import { MicVocal } from 'lucide-react';
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const getSnapshot = () => open;

const setOpen = (value: boolean) => {
  open = value;
  listeners.forEach((listener) => listener());
};

export const LyricsToggle = () => {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = () => setOpen(!isOpen);

  return (
    <Button
      className={cn(isOpen ? 'text-primary' : 'hover:text-primary')}
      variant={isOpen ? 'secondary' : 'ghost'}
      onClick={toggle}
      size={'icon'}
    >
      <MicVocal className="size-4.5" />
    </Button>
  );
};
