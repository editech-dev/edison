// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { executeChatbotTool } from './chatbot_tools';
import { getRepositoryByName, getPublicRepositories } from '@/app/utils/github';

const README = 'Long README '.repeat(200);
const alpha = {
  id: 1, name: 'alpha', html_url: 'https://github.com/owner/alpha', description: 'Alpha', language: 'TypeScript',
  stargazers_count: 2, updated_at: '2026-11-01T00:00:00Z', originalLanguage: 'en' as const,
  en: { description: 'Alpha', readme: README }, es: { description: 'Alfa', readme: `ES ${README}` },
};

vi.mock('@/app/utils/github', () => ({
  getRepositoryByName: vi.fn(async (name: string) => (name === 'alpha' ? alpha : null)),
  getPublicRepositories: vi.fn(async () => [alpha]),
}));
vi.mock('@/app/utils/redis', () => ({ getViews: vi.fn(async () => 3), getCvProfile: vi.fn(async () => ({})) }));

describe('chatbot tools', () => {
  it('reads the README of a published repository only (no private or unknown ones)', async () => {
    const published = (await executeChatbotTool('getRepositoryReadme', { repoName: 'alpha' })) as { readmePreview: string };
    expect(published.readmePreview.length).toBeLessThanOrEqual(803);

    const unknown = (await executeChatbotTool('getRepositoryReadme', { repoName: 'secret-private' })) as { error?: string };
    expect(unknown.error).toMatch(/not part of Edison's published projects/);
    expect(getRepositoryByName).toHaveBeenCalledWith('secret-private');
  });

  it('returns a compact repository list instead of full bilingual READMEs', async () => {
    const result = (await executeChatbotTool('getGithubRepos', {})) as { repositories: Array<Record<string, unknown>> };
    expect(getPublicRepositories).toHaveBeenCalled();
    expect(JSON.stringify(result).length).toBeLessThan(1000);
    expect(result.repositories[0]).not.toHaveProperty('es');
  });

  it('rejects missing or oversized repository names', async () => {
    await expect(executeChatbotTool('getProjectViews', undefined)).rejects.toThrow('valid repoName');
    await expect(executeChatbotTool('getRepositoryReadme', { repoName: 'x'.repeat(101) })).rejects.toThrow('valid repoName');
    expect(await executeChatbotTool('getProjectViews', { repoName: 'alpha' })).toEqual({ repository: 'alpha', views: 3 });
  });
});
