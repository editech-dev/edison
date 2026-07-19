import React from 'react';
import { getCvProfile } from '@/app/utils/redis';
import { Navigation } from '../components/Navigation/Navigation';
import CvClientPage from '../components/CvPage/CvClientPage';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CV',
  alternates: {
    canonical: '/cv',
  },
};

export default async function CvPage() {
  const profile = await getCvProfile();
  return (
    <div>
      <Navigation />
      <CvClientPage profile={profile} />
    </div>
  );
}
