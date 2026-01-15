import { MetadataRoute } from 'next';
import { getPublicRepositories } from '@/app/utils/github';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Base URL from environment variable or fallback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://editech.dev';

  // Static routes
  const routes = [
    '',
    '/contact',
    '/repositories',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    // Dynamic routes from Repositories
    const repositories = await getPublicRepositories();
    
    const repositoryRoutes = repositories.map((repo) => ({
      url: `${baseUrl}/repositories/${repo.name}`,
      lastModified: new Date(), // Ideally this would be repo.updated_at
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...routes, ...repositoryRoutes];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return routes;
  }
}
