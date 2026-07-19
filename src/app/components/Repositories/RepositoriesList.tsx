import { getPublicRepositories } from '@/app/utils/github';
import { getMultipleViews } from '@/app/utils/redis';
import RepositoriesListClient from './RepositoriesListClient';

export default async function RepositoriesList() {
  // Fetch bilingual repositories and views in parallel on the server
  const repositories = await getPublicRepositories();
  const slugs = repositories.map(repo => repo.name);
  const viewsData = await getMultipleViews(slugs);

  return (
    <div className="relative pb-24 bg-gradient-to-tl from-black via-zinc-600/20 to-black min-h-screen text-white">
      <RepositoriesListClient repos={repositories} viewsData={viewsData} />
    </div>
  );
}