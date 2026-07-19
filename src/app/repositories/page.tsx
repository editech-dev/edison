import RepositoriesList from '@/app/components/Repositories/RepositoriesList';
import { Navigation } from '../components/Navigation/Navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic'; // Force real-time updates for view counts

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