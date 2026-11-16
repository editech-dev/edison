import { notFound } from 'next/navigation';
import { getRepositoryByName } from '@/app/utils/github';
import { getViews } from '@/app/utils/redis';
import RepositoryDetailsClient from './RepositoryDetailsClient';

interface RepositoryDetailsProps {
    repoName: string;
}

export default async function RepositoryDetails({ repoName }: RepositoryDetailsProps) {
    const [repoDetails, initialViews] = await Promise.all([
        getRepositoryByName(repoName),
        getViews(repoName)
    ]);

    if (!repoDetails) {
        notFound();
    }

    return (
        <RepositoryDetailsClient repoDetails={repoDetails} initialViews={initialViews} />
    );
}