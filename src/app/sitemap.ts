import { MetadataRoute } from 'next';
import { getPublicRepositories } from '@/app/utils/github';

const hreflangAlternates = (url: string): MetadataRoute.Sitemap[number]['alternates'] => ({
  languages: {
    es: url,
    en: url,
    'x-default': url,
  },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://editech.dev';

  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/cv`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: hreflangAlternates(`${baseUrl}/cv`),
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/repositories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: hreflangAlternates(`${baseUrl}/repositories`),
    },
  ];

  try {
    const repositories = await getPublicRepositories();

    const repositoryRoutes: MetadataRoute.Sitemap = repositories.map((repo) => {
      const repoDate = repo.updated_at ? new Date(repo.updated_at) : null;
      return {
        url: `${baseUrl}/repositories/${repo.name}`,
        lastModified: repoDate && !isNaN(repoDate.getTime()) ? repoDate : new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: hreflangAlternates(`${baseUrl}/repositories/${repo.name}`),
      };
    });

    return [...routes, ...repositoryRoutes];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return routes;
  }
}
