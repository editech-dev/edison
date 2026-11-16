// Exports the translations of the LOCAL development Redis to src/data/bilingual-repos-fallback.json.
// Deploying that file is how production gets them: it reuses a translation whose original text matches,
// without spending tokens and without any direct write to the production Redis.
// Views and chats are never exported. Usage: bun run translations:export
import { createClient } from 'redis';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { LOCAL_REDIS_URL, assertLocalRedis } from '../src/app/utils/runtime-env';
import type { BilingualRepository } from '../src/app/utils/github';

const url = process.env.REDIS_DEV_URL && process.env.REDIS_DEV_URL !== 'memory' ? process.env.REDIS_DEV_URL : LOCAL_REDIS_URL;
assertLocalRedis(url, 'read');

const file = join(process.cwd(), 'src/data/bilingual-repos-fallback.json');
const current = JSON.parse(readFileSync(file, 'utf8')) as Record<string, BilingualRepository>;

const client = createClient({ url });
await client.connect();

let updated = 0;
for await (const keys of client.scanIterator({ MATCH: 'github:repo:bilingual:*', COUNT: 100 })) {
  for (const key of keys) {
    const raw = await client.get(key);
    if (!raw) continue;
    const repo = JSON.parse(raw) as BilingualRepository;
    // Only real translations: placeholders copy the original text in both languages.
    if (repo.translated === false || !repo.es || !repo.en) continue;
    const entry: BilingualRepository = {
      id: repo.id,
      name: repo.name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      updated_at: repo.updated_at,
      originalLanguage: repo.originalLanguage,
      es: repo.es,
      en: repo.en,
    };
    if (JSON.stringify(current[repo.name]) !== JSON.stringify(entry)) updated++;
    current[repo.name] = entry;
  }
}
await client.quit();

const sorted = Object.fromEntries(Object.keys(current).sort((a, b) => a.localeCompare(b)).map((name) => [name, current[name]]));
writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Exported translations: ${updated} new or changed, ${Object.keys(sorted).length} repositories in ${file}.`);
