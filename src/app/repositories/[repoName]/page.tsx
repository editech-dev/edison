import { Navigation } from '@/app/components/Navigation/Navigation';
import RepositoryDetails from '@/app/components/Repositories/RepositoryDetails';
import { getPublicRepositories, getRepositoryByName } from '@/app/utils/github';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Details come from the cached snapshot (no fetch), so revalidation is declared explicitly.
export const revalidate = 3600;

interface RepositoryPageProps {
  params: Promise<{ repoName: string }>;
}

export async function generateMetadata({ params }: RepositoryPageProps): Promise<Metadata> {
  const { repoName } = await params;
  const repository = await getRepositoryByName(repoName);
  if (!repository) {
    return { title: 'Repository not found', robots: { index: false } };
  }

  return {
    title: `Repository: ${repository.name}`,
    alternates: {
      canonical: `/repositories/${repository.name}`,
    },
  };
}

export async function generateStaticParams(): Promise<{ repoName: string }[]> {
  try {
    const repositories = await getPublicRepositories();
    return repositories
      .filter((repo) => typeof repo?.name === 'string' && repo.name.trim() !== '')
      .map((repo) => ({ repoName: repo.name }));
  } catch (error) {
    console.error('Error occurred in generateStaticParams:', error);
    return [];
  }
}

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { repoName } = await params;

  // `getRepositoryByName` is deduplicated with React `cache`, so RepositoryDetails reuses this result.
  // It returns null only when the repository does not exist (GitHub 404): that is a real 404.
  // Any other failure throws and is reported as an error, never as "not found".
  if (!(await getRepositoryByName(repoName))) {
    notFound();
  }

  return (
    <div className="relative pb-16 bg-gradient-to-tl from-black via-zinc-600/20 to-black min-h-screen text-white">
      <Navigation />
      <RepositoryDetails repoName={repoName} />
    </div>
  );
}
