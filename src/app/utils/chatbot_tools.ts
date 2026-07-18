import { getPublicRepositories, getReadmeContent } from '@/app/utils/github';
import { getViews } from '@/app/utils/redis';
import fs from 'fs';
import path from 'path';

// Load local experience and contact info from profile.json
export async function getProfileInfo() {
  try {
    const profilePath = path.join(process.cwd(), 'src/data/profile.json');
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    return profileData;
  } catch (error) {
    console.error("Error reading profile.json inside tools:", error);
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

// Helper to check README content
export async function getRepositoryReadme(repoName: string) {
  try {
    const readme = await getReadmeContent(repoName);
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
export async function executeChatbotTool(name: string, args: any) {
  switch (name) {
    case 'getProfileInfo':
      return await getProfileInfo();
    case 'getGithubRepos':
      return await getPublicRepositories();
    case 'getRepositoryReadme':
      return await getRepositoryReadme(args.repoName);
    case 'getProjectViews':
      return await getProjectViews(args.repoName);
    default:
      throw new Error(`Tool ${name} not found`);
  }
}
