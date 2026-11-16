// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_CONTEXT_TOKENS, README_PREVIEW_CHARS, buildSystemInstruction, estimateTokens, toRepositoryContext } from './agent-context';
import type { BilingualRepository } from './github';

const load = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

// Real data shipped with the repo: the static bilingual fallback and the CV profile.
const fallback = JSON.parse(load('src/data/bilingual-repos-fallback.json')) as Record<string, BilingualRepository>;
// Same rule as the published list (github.ts): only repositories with a README of at least 100 characters.
const repos = Object.values(fallback)
  .filter((repo) => (repo[repo.originalLanguage]?.readme?.length ?? 0) >= 100)
  .map((repo) => ({ ...repo, updated_at: repo.updated_at ?? '', description: repo.description ?? null }));
const profile = JSON.parse(load('src/data/cv-profile.json'));
const template = load('src/app/utils/expert_persona.xml');

describe('chat context', () => {
  it('keeps the whole system instruction under the documented token cap', () => {
    const instruction = buildSystemInstruction(template, profile, repos);
    expect(estimateTokens(instruction)).toBeLessThanOrEqual(MAX_CONTEXT_TOKENS);
  });

  it('includes both descriptions and a bounded README preview, never the full READMEs', () => {
    const longest = repos.reduce((a, b) => ((a.en.readme?.length ?? 0) > (b.en.readme?.length ?? 0) ? a : b));
    const context = toRepositoryContext(longest);

    expect(context.readme_preview.length).toBeLessThanOrEqual(README_PREVIEW_CHARS + 3);
    expect(context).toHaveProperty('description_es');
    expect(context).toHaveProperty('description_en');
    expect(Object.keys(context)).not.toContain('es');
    expect(Object.keys(context)).not.toContain('en');
  });
});
