import { AppRouter } from '@/app/Router';
import { useAccentColor } from '@/shared/hooks/useAccentColor';
import { useThemeSync } from '@/shared/hooks/useThemeSync';
import { useWindowDrag } from '@/shared/hooks/useWindowDrag';
import { useWindowState } from '@/shared/hooks/useWindowState';
import '../assets/css/index.css';
import { Toaster } from 'sonner';
import { Providers } from './Providers';

export default function App() {
  useThemeSync();
  useAccentColor();
  const { state } = useWindowState();
  useWindowDrag('drag-region', { disabled: state === 'fullscreen' });
  return (
    <Providers>
      <AppRouter />
      <Toaster position="top-right" richColors style={{ top: '2.5rem' }} />
    </Providers>
  );
}
