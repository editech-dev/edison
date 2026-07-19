"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { FaArrowLeft, FaGithub, FaStar } from 'react-icons/fa';
import clsx from 'clsx';
import { customMdxComponents } from '@/app/components/Mdx/customComponents';
import ViewCounter from './ViewCounter';
import LanguageToggle from './LanguageToggle';
import { BilingualRepository } from '@/app/utils/github';

interface RepositoryDetailsClientProps {
  repoDetails: BilingualRepository;
  initialViews: number;
}

const REPO_OWNER = process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER || 'editech-dev';

export default function RepositoryDetailsClient({ repoDetails, initialViews }: RepositoryDetailsClientProps) {
  const [language, setLanguage] = useState<'es' | 'en'>('en');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Detect preferred language:
    const storedLang = localStorage.getItem('preferred-language');
    if (storedLang === 'es' || storedLang === 'en') {
      setLanguage(storedLang);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('es')) {
        setLanguage('es');
        return;
      }
    }
    setLanguage('en');
  }, []);

  const handleLanguageChange = (lang: 'es' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }));
  };

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

  // Image component replacement for relative paths inside README
  const ImageComponent = ({ className, alt, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const defaultBranch = 'main';
    let finalSrc = src;

    if (typeof src === 'string' && REPO_OWNER && repoDetails.name && !src.startsWith('http://') && !src.startsWith('https://')) {
      const baseUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${repoDetails.name}/${defaultBranch}/`;
      try {
        const relativePath = src.startsWith('/') ? src.substring(1) : src;
        finalSrc = new URL(relativePath, baseUrl).href;
      } catch (e) {
        console.error(`Error constructing URL for relative image src "${src}"`, e);
        finalSrc = '#error-constructing-image-url';
      }
    }

    const baseImageClasses = "rounded-md border border-zinc-700 my-4 max-w-full h-auto";

    return (
      <img
        src={finalSrc}
        className={clsx(baseImageClasses, className)}
        alt={alt || ''}
        loading="lazy"
        {...props}
      />
    );
  };

  const componentsForRender = {
    ...customMdxComponents,
    img: ImageComponent,
  };

  // Get active translated content, with fallback
  const content = repoDetails[language] || repoDetails.en || repoDetails.es || { description: repoDetails.description, readme: '' };
  const description = content.description || repoDetails.description;
  const readmeContent = content.readme;

  return (
    <div className="container mx-auto relative overflow-hidden">
      {/* --- Header --- */}
      <header className="relative py-16 sm:py-24 px-6 lg:px-8 text-center flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-8 max-w-4xl">
          {/* Contenedor para iconos y metadatos */}
          <div className="flex items-center gap-4 mt-5 text-sm">
            {repoDetails.html_url && (
              <a
                href={repoDetails.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="duration-200 hover:font-medium text-green-400 hover:text-green-300 flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900"
                title="View on GitHub"
              >
                <FaGithub className="w-5 h-5" aria-hidden="true" />
                <span>GitHub</span>
              </a>
            )}
            {/* Estrellas */}
            <span className="inline-flex items-center gap-1 text-zinc-400" title={`${repoDetails.stargazers_count} stars`}>
              <FaStar className={`w-4 h-4 ${repoDetails.stargazers_count > 0 ? 'text-yellow-500 animate-pulse' : ''}`} aria-hidden="true" />
              <span className="sr-only">{language === 'es' ? 'Estrellas: ' : 'Stars: '}</span>
              {repoDetails.stargazers_count}
            </span>
            {/* Views counter */}
            <ViewCounter
              slug={repoDetails.name}
              initialViews={initialViews}
              trackView={true}
              language={language}
            />
          </div>
          {/* Language Switcher */}
          <div className="mt-5">
            <LanguageToggle currentLang={language} onChange={handleLanguageChange} />
          </div>
        </div>

        {/* Título y Descripción */}
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h1 className="text-green-400 text-4xl font-bold tracking-tight sm:text-5xl font-display break-words">
            {repoDetails.name}
          </h1>
          {description && (
            <p className="text-green-300 mt-4 text-lg leading-8">
              {description}
            </p>
          )}
        </div>
      </header>

      {/* --- Divisor --- */}
      <div className="w-full h-px bg-zinc-700 max-w-4xl mx-auto mb-12" />

      {/* --- Contenido del README --- */}
      <article className="px-4 pb-12 mx-auto max-w-4xl prose prose-invert prose-headings:text-green-400 prose-a:text-green-400 hover:prose-a:text-green-300 prose-strong:text-green-200">
        {readmeContent ? (
          <ReactMarkdown
            rehypePlugins={[
              rehypeRaw,
              rehypeSlug,
              [rehypeAutolinkHeadings, {
                behavior: 'prepend',
                properties: { className: ['anchor-link'] },
                content: () => <span className="anchor-icon" aria-hidden="true">#</span>
              }],
            ]}
            components={componentsForRender}
          >
            {readmeContent}
          </ReactMarkdown>
        ) : (
          <p className="text-center text-zinc-400 mt-10 italic">
            {language === 'es'
              ? 'No se pudo encontrar un archivo README.md o ocurrió un error al cargarlo.'
              : 'A README.md file could not be found or an error occurred while loading it.'}
          </p>
        )}
      </article>
    </div>
  );
}
