"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaStar, FaEye } from 'react-icons/fa';
import ViewCounter from './ViewCounter';
import LanguageToggle from './LanguageToggle';
import { BilingualRepository } from '@/app/utils/github';

interface RepositoriesListClientProps {
  repos: BilingualRepository[];
  viewsData: Record<string, number>;
}

export default function RepositoriesListClient({ repos, viewsData }: RepositoriesListClientProps) {
  const [language, setLanguage] = useState<'es' | 'en'>('en');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Detect preferred language:
    // 1. Check local storage
    const storedLang = localStorage.getItem('preferred-language');
    if (storedLang === 'es' || storedLang === 'en') {
      setLanguage(storedLang);
      return;
    }

    // 2. Check browser navigator language
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('es')) {
        setLanguage('es');
        return;
      }
    }

    // 3. Fallback to English
    setLanguage('en');
  }, []);

  const handleLanguageChange = (lang: 'es' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
    // Dispatch a custom event to sync with other components on the page (like RepositoryDetails if mounted)
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }));
  };

  // Sync language state if it changes in another component
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'es' || detail === 'en') {
        setLanguage(detail);
      }
    };
    window.addEventListener('languageChange', handleSync);
    return () => window.removeEventListener('languageChange', handleSync);
  }, []);

  // Filter repositories (featured with stars vs other)
  const starredRepos = repos.filter(repo => repo.stargazers_count > 0);
  const otherRepos = repos.filter(repo => repo.stargazers_count === 0);

  const renderRepoCard = (repo: BilingualRepository, isStarred: boolean) => {
    const views = viewsData[repo.name] ?? 0;
    
    // Choose translation, fallback to English then original if not found
    const content = repo[language] || repo.en || repo.es || { description: repo.description };
    const description = content.description || repo.description || (language === 'es' ? 'Sin descripción disponible.' : 'No description available.');

    return (
      <li
        key={repo.id}
        className={`bg-zinc-900/60 p-4 rounded-lg flex flex-col justify-between transition-all duration-300 ease-in-out hover:bg-zinc-800/80 border ${
          isStarred 
            ? 'border-green-500/20 hover:border-green-400/40 shadow-[0_0_15px_rgba(34,197,94,0.03)] hover:shadow-[0_0_20px_rgba(34,197,94,0.12)]' 
            : 'border-transparent hover:border-green-500/30'
        }`}
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-xl font-semibold font-sans">
              <Link 
                href={`/repositories/${repo.name}`} 
                className="text-green-400 hover:text-green-300 hover:underline break-words rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900"
              >
                {repo.name}
              </Link>
            </h2>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-green-400 flex-shrink-0 ml-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900"
              aria-label={language === 'es' ? `Ver ${repo.name} en GitHub` : `View ${repo.name} on GitHub`}
            >
              GitHub ↗
            </a>
          </div>
          <p className="text-zinc-300 mb-4 text-sm flex-grow line-clamp-3">
            {description}
          </p>
        </div>

        {/* Metadatos (Lenguaje, Estrellas, Vistas) */}
        <div className="flex items-center space-x-4 text-sm text-zinc-400 mt-auto pt-2 border-t border-zinc-800/50">
          {repo.language && (
            <span className="inline-flex items-center">
              <span className="mr-1.5 text-xs text-green-500" aria-hidden="true">●</span>
              {repo.language}
            </span>
          )}
          <span className="inline-flex items-center">
            <FaStar className={`h-4 w-4 mr-1 ${isStarred ? 'text-yellow-500 animate-pulse' : 'text-zinc-500'}`} aria-hidden="true" />
            <span className="sr-only">{language === 'es' ? 'Estrellas: ' : 'Stars: '}</span>
            {repo.stargazers_count}
          </span>
          <ViewCounter
            slug={repo.name}
            initialViews={views}
            trackView={false}
            shouldFetch={true}
            language={language}
          />
        </div>
      </li>
    );
  };

  return (
    <div className="px-6 pt-20 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-12 md:pt-24 lg:pt-32">
      {/* Header section with flex layout for title and toggle switch */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-green-400 sm:text-4xl">
            {language === 'es' ? 'Mis Repositorios Públicos' : 'My Public Repositories'}
          </h1>
          <p className="mt-4 text-green-300">
            {language === 'es' 
              ? 'Explorando proyectos y código fuente en GitHub.' 
              : 'Exploring projects and source code on GitHub.'}
          </p>
        </div>
        <div className="flex-shrink-0">
          <LanguageToggle currentLang={language} onChange={handleLanguageChange} />
        </div>
      </div>
      
      <div className="w-full h-px bg-zinc-800" />

      {repos.length > 0 ? (
        <div className="space-y-12">
          {/* Starred Repositories Section */}
          {starredRepos.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold tracking-wider text-green-400 uppercase flex items-center gap-2">
                <FaStar className="h-5 w-5 text-yellow-500 animate-pulse" />
                {language === 'es' ? 'Proyectos Destacados' : 'Featured Projects'}
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
                {starredRepos.length > 0 
                  ? (language === 'es' ? 'Otros Proyectos' : 'Other Projects') 
                  : (language === 'es' ? 'Todos los Proyectos' : 'All Projects')}
              </h2>
              <ul className="grid grid-cols-1 gap-6 mx-auto lg:mx-0 md:grid-cols-2 lg:grid-cols-3">
                {otherRepos.map(repo => renderRepoCard(repo, false))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-zinc-400">
          {language === 'es' 
            ? 'No se encontraron repositorios públicos, o ocurrió un error al cargarlos.' 
            : 'No public repositories found, or an error occurred while loading them.'}
        </p>
      )}
    </div>
  );
}
