import Link from 'next/link';
import { getRepositoryByName } from '@/app/utils/github';
import { getViews } from '@/app/utils/redis';
import { FaArrowLeft } from 'react-icons/fa';
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
        return (
            <div className="container mx-auto px-6 py-12 text-center text-white">
                <p className="text-red-500">Error: Details not found for repository "{repoName}".</p>
                <p className="text-zinc-400 mt-2">Verify that the name is correct and that the repository exists.</p>
                <Link href="/repositories" className="text-blue-400 hover:underline mt-4 inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 focus-visible:ring-offset-zinc-900">
                    <FaArrowLeft className="w-4 h-4 inline mr-1" aria-hidden="true" /> Back to list
                </Link>
            </div>
        );
    }

    return (
        <RepositoryDetailsClient repoDetails={repoDetails} initialViews={initialViews} />
    );
}