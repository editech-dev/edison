import { getPublicRepositories, getRepositoryByName } from '@/app/utils/github';
import { toRepositoryContext } from '@/app/utils/agent-context';
import { getViews } from '@/app/utils/redis';
import fs from 'fs';
import path from 'path';

// Load local experience and contact info from Redis (with local fallback)
export async function getProfileInfo() {
  try {
    const { getCvProfile } = await import('@/app/utils/redis');
    const profileData = await getCvProfile();
    return profileData;
  } catch (error) {
    console.error("Error reading profile from Redis inside tools:", error);
    return { error: "Could not retrieve profile information at this time." };
  }
}

// Load repo views from Redis
export async function getProjectViews(repoName: string) {
  try {
    const views = await getViews(repoName);
    return { repository: repoName, views };
  } catch (error) {
    console.error(`Error getting views for ${repoName} inside tools:`, error);
    return { repository: repoName, views: 0, error: "Could not retrieve view count from database." };
  }
}

// README of a PUBLISHED repository only (from the snapshot): never private or unknown repositories, and no
// extra GitHub call.
export async function getRepositoryReadme(repoName: string) {
  try {
    const repo = await getRepositoryByName(repoName);
    if (!repo) {
      return { repoName, error: "This repository is not part of Edison's published projects." };
    }
    const readme = repo[repo.originalLanguage]?.readme ?? repo.en?.readme ?? repo.es?.readme ?? null;
    if (!readme) {
      return { repoName, readmePreview: "No README available for this repository." };
    }
    // Truncate to first 800 chars to avoid model context bloat
    const readmePreview = readme.substring(0, 800) + (readme.length > 800 ? "..." : "");
    return { repoName, readmePreview };
  } catch (error) {
    console.error(`Error getting README for ${repoName} inside tools:`, error);
    return { repoName, error: "Could not retrieve README content." };
  }
}

// Tool Declaration Schemas matching the new Google Gen AI SDK
export const chatbotToolDeclarations: any[] = [
  {
    name: 'getProfileInfo',
    description: 'Retrieves Edison Isaza\'s professional profile details including skills, work experience (representing LinkedIn data), biography, and contact channels (email, whatsapp, linkedin URL).',
    parameters: {
      type: 'OBJECT',
      properties: {},
    }
  },
  {
    name: 'getGithubRepos',
    description: 'Retrieves the list of Edison\'s public, high-quality projects fetched from GitHub containing names, descriptions, main programming languages, and stars count.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    }
  },
  {
    name: 'getRepositoryReadme',
    description: 'Retrieves a preview of the README file of a specific GitHub repository by name to answer detailed technical implementation questions or deployment setup.',
    parameters: {
      type: 'OBJECT',
      properties: {
        repoName: {
          type: 'STRING',
          description: 'The exact name of the GitHub repository (e.g. edison-dev)'
        }
      },
      required: ['repoName']
    }
  },
  {
    name: 'getProjectViews',
    description: 'Retrieves the dynamic page view count for a specific portfolio project from Redis to determine interest or popularity.',
    parameters: {
      type: 'OBJECT',
      properties: {
        repoName: {
          type: 'STRING',
          description: 'The name/slug of the project repository (e.g. edison-dev)'
        }
      },
      required: ['repoName']
    }
  }
];

// Helper to execute tools based on model requests
const repoNameArg = (args: unknown): string => {
  const value = (args as { repoName?: unknown } | undefined)?.repoName;
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    throw new Error('A valid repoName is required.');
  }
  return value;
};

export async function executeChatbotTool(name: string, args: unknown) {
  switch (name) {
    case 'getProfileInfo':
      return await getProfileInfo();
    case 'getGithubRepos':
      // Compact summary (descriptions + short README preview), not the full bilingual READMEs.
      return { repositories: (await getPublicRepositories()).map(toRepositoryContext) };
    case 'getRepositoryReadme':
      return await getRepositoryReadme(repoNameArg(args));
    case 'getProjectViews':
      return await getProjectViews(repoNameArg(args));
    default:
      throw new Error(`Tool ${name} not found`);
  }
}
