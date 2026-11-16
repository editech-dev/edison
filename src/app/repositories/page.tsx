import RepositoriesList from '@/app/components/Repositories/RepositoriesList';
import { Navigation } from '../components/Navigation/Navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic'; // Force real-time updates for view counts
// Leaves room for the background refresh scheduled with `after()`; the response itself never waits on it.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Projects',
  alternates: {
    canonical: '/repositories',
  },
};

export default function RepositoriesPage() {
  return (
    <div>
      < Navigation />
      <RepositoriesList />
    </div>
  );
}