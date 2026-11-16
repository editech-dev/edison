'use client';

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

// Shown when a repository cannot be loaded (e.g. GitHub unavailable). A missing repository is a 404
// and uses not-found.tsx instead.
export default function RepositoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const linkStyle =
    'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-green-400 transition-colors duration-200 hover:border-green-400 hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-tl from-black via-zinc-600/20 to-black px-6 text-center text-white">
      <h1 className="text-3xl font-bold sm:text-4xl">This repository could not be loaded</h1>
      <p className="mt-4 max-w-md text-zinc-400">GitHub did not answer in time. Please try again in a moment.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className={linkStyle}>
          Try again
        </button>
        <Link href="/repositories" className={linkStyle}>
          <FaArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to projects
        </Link>
      </div>
    </div>
  );
}
