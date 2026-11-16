import type { BilingualRepository } from './github';

// The chat model receives this context on every message, so it is kept small: full READMEs (in two
// languages) used to make it ~90,000 tokens. Full READMEs stay available on demand through the chat tool
// `getRepositoryReadme`.
export const README_PREVIEW_CHARS = 200;
/** Upper bound for the whole system instruction, in estimated tokens (see estimateTokens). */
export const MAX_CONTEXT_TOKENS = 15_000;

/** Rough token estimate (≈ 4 characters per token for mixed English/Spanish text and JSON). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export interface RepositoryContext {
  name: string;
  url: string;
  language: string | null;
  stars: number;
  updated_at: string;
  description_es: string | null;
  description_en: string | null;
  readme_preview: string;
}

export const toRepositoryContext = (repo: BilingualRepository): RepositoryContext => {
  const readme = repo[repo.originalLanguage]?.readme ?? repo.en?.readme ?? repo.es?.readme ?? null;
  const preview = readme ? readme.replace(/\s+/g, ' ').trim() : '';
  return {
    name: repo.name,
    url: repo.html_url,
    language: repo.language,
    stars: repo.stargazers_count,
    updated_at: repo.updated_at,
    description_es: repo.es?.description ?? repo.description,
    description_en: repo.en?.description ?? repo.description,
    readme_preview: preview
      ? preview.length > README_PREVIEW_CHARS
        ? `${preview.slice(0, README_PREVIEW_CHARS)}...`
        : preview
      : 'No README available',
  };
};

// For the system prompt: one description field when both languages are identical (untranslated repos).
const compactRepositoryContext = (repo: BilingualRepository) => {
  const { description_es, description_en, ...rest } = toRepositoryContext(repo);
  return description_es === description_en
    ? { ...rest, description: description_en }
    : { ...rest, description_es, description_en };
};

export const buildSystemInstruction = (template: string, profile: unknown, repos: BilingualRepository[]) =>
  template
    // Replacement functions, so `$&`-style sequences inside the data are not interpreted.
    .replace('{{PROFILE_CONTEXT}}', () => JSON.stringify(profile))
    .replace('{{GITHUB_CONTEXT}}', () => JSON.stringify(repos.map(compactRepositoryContext)));
