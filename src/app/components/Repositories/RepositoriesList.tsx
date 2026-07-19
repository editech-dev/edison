import Link from 'next/link';
import ViewCounter from './ViewCounter'; // Import ViewCounter
import { getPublicRepositories } from '@/app/utils/github';
import { getMultipleViews } from '@/app/utils/redis'; // Importa la función de Redis
import { FaStar, FaEye } from 'react-icons/fa'; // Importa el ícono del ojo

// Interfaz GitHubRepository
interface GitHubRepository {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

export default async function RepositoriesList() {
  // Obtener repositorios y vistas en paralelo
  const repositories: GitHubRepository[] = await getPublicRepositories();
  const slugs = repositories.map(repo => repo.name);
  const viewsData = await getMultipleViews(slugs);

  // Filtrar repositorios (destacados con estrellas vs otros)
  const starredRepos = repositories.filter(repo => repo.stargazers_count > 0);
  const otherRepos = repositories.filter(repo => repo.stargazers_count === 0);

  const renderRepoCard = (repo: GitHubRepository, isStarred: boolean) => {
    const views = viewsData[repo.name] ?? 0; // Obtiene las vistas para este repo

    return (
      <li
        key={repo.id}
        className={`bg-zinc-900 p-4 rounded-lg flex flex-col justify-between transition-all duration-300 ease-in-out hover:bg-zinc-800 border ${
          isStarred 
            ? 'border-yellow-500/10 hover:border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.02)] hover:shadow-[0_0_20px_rgba(234,179,8,0.08)]' 
            : 'border-transparent hover:border-green-500/30'
        }`}
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-xl font-semibold font-sans">
              <Link href={`/repositories/${repo.name}`} className="text-green-400 hover:text-green-300 hover:underline break-words rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900">
                {repo.name}
              </Link>
            </h2>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-green-400 flex-shrink-0 ml-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900"
              aria-label={`View ${repo.name} on GitHub`}
            >
              GitHub ↗
            </a>
          </div>
          <p className="text-zinc-300 mb-4 text-sm flex-grow">
            {repo.description || 'No description available.'}
          </p>
        </div>

        {/* Metadatos (Lenguaje, Estrellas, Vistas) */}
        <div className="flex items-center space-x-4 text-sm text-zinc-400 mt-auto pt-2 border-t border-zinc-700/50">
          {repo.language && (
            <span className="inline-flex items-center">
              <span className="mr-1.5 text-xs" aria-hidden="true">●</span>
              {repo.language}
            </span>
          )}
          <span className="inline-flex items-center">
            <FaStar className={`h-4 w-4 mr-1 ${isStarred ? 'text-yellow-500 animate-pulse' : 'text-zinc-500'}`} aria-hidden="true" />
            <span className="sr-only">Stars: </span>
            {repo.stargazers_count}
          </span>
          {/* Use ViewCounter for live updates */}
          <ViewCounter
            slug={repo.name}
            initialViews={viewsData[repo.name] || 0}
            trackView={false}
            shouldFetch={true}
          />
        </div>
      </li>
    );
  };

  return (
    <div className="relative pb-24 bg-gradient-to-tl from-black via-zinc-600/20 to-black min-h-screen text-white">
      {/* <Navigation /> */}
      <div className="px-6 pt-20 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-12 md:pt-24 lg:pt-32">
        <div className="max-w-2xl mx-auto lg:mx-0">
          <h1 className="text-3xl font-bold tracking-tight text-green-400 sm:text-4xl">
            My Public Repositories
          </h1>
          <p className="mt-4 text-green-300">
            Exploring projects and source code on GitHub.
          </p>
        </div>
        <div className="w-full h-px bg-zinc-800" />

        {repositories.length > 0 ? (
          <div className="space-y-12">
            {/* Starred Repositories Section */}
            {starredRepos.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold tracking-wider text-yellow-500 uppercase flex items-center gap-2">
                  <FaStar className="h-5 w-5 text-yellow-500 animate-pulse" />
                  Featured Projects
                </h2>
                <ul className="grid grid-cols-1 gap-6 mx-auto lg:mx-0 md:grid-cols-2 lg:grid-cols-3">
                  {starredRepos.map(repo => renderRepoCard(repo, true))}
                </ul>
              </div>
            )}

            {/* Section Divider if there are both types */}
            {starredRepos.length > 0 && otherRepos.length > 0 && (
              <div className="w-full h-px bg-zinc-850" />
            )}

            {/* Other Repositories Section */}
            {otherRepos.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold tracking-wider text-zinc-400 uppercase">
                  {starredRepos.length > 0 ? "Other Projects" : "All Projects"}
                </h2>
                <ul className="grid grid-cols-1 gap-6 mx-auto lg:mx-0 md:grid-cols-2 lg:grid-cols-3">
                  {otherRepos.map(repo => renderRepoCard(repo, false))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-zinc-400">
            No public repositories found, or an error occurred while loading them.
          </p>
        )}
      </div>
    </div>
  );
}