import { usePageTitle } from '@/app/layout/PageTitleContext';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Banner } from './components/Banner';
import { PersonalizedPlaylists } from './components/PersonalizedPlaylists';
import { TopPlaylists } from './components/TopPlaylists';

export default function HomePage() {
  usePageTitle('发现', { root: true });
  const scrollRef = useScrollMemory();

  return (
    <ScrollArea className="h-full px-6 py-3" ref={scrollRef}>
      <div className="space-y-8">
        <Banner />

        <PersonalizedPlaylists />

        <TopPlaylists />
      </div>
    </ScrollArea>
  );
}
