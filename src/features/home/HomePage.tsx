import { usePageTitle } from '@/app/layout/PageTitleContext';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Banner } from './components/Banner';
import { PersonalizedPlaylists } from './components/PersonalizedPlaylists';
import { TopPlaylists } from './components/TopPlaylists';

export default function HomePage() {
  usePageTitle('发现', { root: true });

  return (
    <ScrollArea className="h-full px-6 py-3">
      <div className="space-y-8">
        <Banner />

        <PersonalizedPlaylists />

        <TopPlaylists />
      </div>
    </ScrollArea>
  );
}
