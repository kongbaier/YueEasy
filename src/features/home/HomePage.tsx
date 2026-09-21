import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Banner } from './components/Banner';
import { PersonalizedPlaylists } from './components/PersonalizedPlaylists';
import { TopPlaylists } from './components/TopPlaylists';

export default function HomePage() {
  usePageTitle('发现', { root: true });

  return (
    <div className="space-y-8 px-6 py-3">
      <Banner />

      <PersonalizedPlaylists />

      <TopPlaylists />
    </div>
  );
}
