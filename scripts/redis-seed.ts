// Fills the LOCAL development Redis with synthetic data (views and fake chats).
// It never copies production data and refuses to run against a non-local host.
// Usage: bun run redis:seed
import { createClient } from 'redis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LOCAL_REDIS_URL, assertLocalRedis } from '../src/app/utils/runtime-env';

const url = process.env.REDIS_DEV_URL && process.env.REDIS_DEV_URL !== 'memory' ? process.env.REDIS_DEV_URL : LOCAL_REDIS_URL;
assertLocalRedis(url, 'seed');

const fallback = JSON.parse(readFileSync(join(process.cwd(), 'src/data/bilingual-repos-fallback.json'), 'utf8')) as Record<string, unknown>;
const repoNames = Object.keys(fallback);

const client = createClient({ url });
await client.connect();

// Deterministic fake view counts, so runs are reproducible.
for (const [index, name] of repoNames.entries()) {
  await client.set(`views:${name}`, String((index * 7) % 25));
}

const fakeChats = [
  { id: 'seed-chat-1', messages: [{ role: 'user', content: 'What projects does Edison have in Python?' }, { role: 'assistant', content: 'Edison has several Python projects, such as transcription-api.' }] },
  { id: 'seed-chat-2', messages: [{ role: 'user', content: '¿Cuántas vistas tiene vortex-one?' }, { role: 'assistant', content: 'El repositorio vortex-one tiene 7 vistas.' }] },
];
for (const chat of fakeChats) {
  const timestamp = new Date('2026-01-01T12:00:00Z').toISOString();
  await client.set(`chat:${chat.id}`, JSON.stringify({ messages: chat.messages, timestamp }));
  await client.sAdd('chat_index', chat.id);
  await client.hSet(`chat_meta:${chat.id}`, { timestamp, preview: chat.messages.at(-1)!.content.slice(0, 50) });
}

console.log(`Seeded ${repoNames.length} view counters and ${fakeChats.length} fake chats into ${url}.`);
await client.quit();
