import { describe, it, expect, vi } from 'vitest';
import { getRepositoryByName } from '@/app/utils/github';
import RepositoryPage, { generateMetadata } from './page';

vi.mock('@/app/utils/github', () => ({
  getRepositoryByName: vi.fn(),
  getPublicRepositories: vi.fn(async () => []),
}));
vi.mock('@/app/components/Navigation/Navigation', () => ({ Navigation: () => null }));
vi.mock('@/app/components/Repositories/RepositoryDetails', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));

const props = (repoName: string) => ({ params: Promise.resolve({ repoName }) });

describe('/repositories/[repoName]', () => {
  it('responds 404 when the repository does not exist', async () => {
    vi.mocked(getRepositoryByName).mockResolvedValue(null);

    await expect(RepositoryPage(props('does-not-exist'))).rejects.toThrow('404');
    const metadata = await generateMetadata(props('does-not-exist'));
    expect(metadata.robots).toEqual({ index: false });
  });

  it('renders the page for an existing repository', async () => {
    vi.mocked(getRepositoryByName).mockResolvedValue({
      id: 1,
      name: 'alpha',
      html_url: 'https://github.com/owner/alpha',
      description: null,
      language: null,
      stargazers_count: 0,
      updated_at: '',
      originalLanguage: 'en',
      es: { description: null, readme: null },
      en: { description: null, readme: null },
    });

    await expect(RepositoryPage(props('alpha'))).resolves.toBeTruthy();
    const metadata = await generateMetadata(props('alpha'));
    expect(metadata.alternates?.canonical).toBe('/repositories/alpha');
  });

  it('reports an error (not a 404) when GitHub cannot be reached', async () => {
    vi.mocked(getRepositoryByName).mockRejectedValue(new Error('GitHub timeout'));

    await expect(RepositoryPage(props('unknown'))).rejects.toThrow('GitHub timeout');
  });
});
