import Link from 'next/link';
import type { Metadata } from 'next';
import { FaArrowLeft, FaHome } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

const linkStyle =
  'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-green-400 transition-colors duration-200 hover:border-green-400 hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-tl from-black via-zinc-600/20 to-black px-6 text-center text-white">
      <p className="font-mono text-sm text-green-400">404</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Page not found</h1>
      <p className="mt-4 max-w-md text-zinc-400">
        The page or repository you are looking for does not exist or was moved.
      </p>
      <nav aria-label="Not found navigation" className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/repositories" className={linkStyle}>
          <FaArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to projects
        </Link>
        <Link href="/" className={linkStyle}>
          <FaHome className="h-4 w-4" aria-hidden="true" />
          Home
        </Link>
      </nav>
    </div>
  );
}
