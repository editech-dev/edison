import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';

type RedisClient = ReturnType<typeof createClient>;

// Without REDIS_URL the app always uses the in-memory store (local development and tests).
const REDIS_URL = process.env.REDIS_URL;
// Never make a request wait longer than this for a connection.
const CONNECT_TIMEOUT_MS = 2000;
// After a failure, serve from memory for this long before trying Redis again.
const RETRY_COOLDOWN_MS = 30_000;

let client: RedisClient | null = null;
let connecting: Promise<void> | null = null;
let retryAfter = 0;

const markUnavailable = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.warn(`Redis unavailable (${message}). Using the in-memory store for ${RETRY_COOLDOWN_MS / 1000}s.`);
    retryAfter = Date.now() + RETRY_COOLDOWN_MS;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis connection timeout')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const discard = (stale: RedisClient) => {
    if (client === stale) client = null;
    stale.disconnect().catch(() => {});
};

const createRedisClient = (): RedisClient => {
    const created = createClient({
        url: REDIS_URL,
        // Fail fast instead of queueing commands while disconnected.
        disableOfflineQueue: true,
        socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false },
    });
    created.on('error', (err) => {
        console.error('Redis Client Error:', err?.message || err);
        if (client === created) {
            markUnavailable(err);
            discard(created);
        }
    });
    return created;
};

// Returns a ready client, or null when Redis is not configured or currently unavailable.
// A failure is never permanent: after RETRY_COOLDOWN_MS a new connection is attempted.
const getClient = async (): Promise<RedisClient | null> => {
    if (!REDIS_URL) return null;
    if (client?.isReady) return client;
    if (Date.now() < retryAfter) return null;

    if (!connecting) {
        const candidate = createRedisClient();
        client = candidate;
        connecting = withTimeout(candidate.connect().then(() => undefined), CONNECT_TIMEOUT_MS)
            .catch((err) => {
                markUnavailable(err);
                discard(candidate);
            })
            .finally(() => {
                connecting = null;
            });
    }
    await connecting;
    return client?.isReady ? client : null;
};

// --- In-Memory Mock Fallback Store ---
const memoryStore = new Map<string, string>();
const memorySets = new Map<string, Set<string>>();
const memoryHashes = new Map<string, Record<string, string>>();

export const saveChat = async (chatId: string, messageData: any) => {
    const redis = await getClient();
    const key = `chat:${chatId}`;
    
    if (redis) {
        try {
            await redis.set(key, JSON.stringify(messageData));
            await redis.sAdd('chat_index', chatId);
            await redis.hSet(`chat_meta:${chatId}`, {
                timestamp: new Date().toISOString(),
                preview: messageData.messages ? messageData.messages[messageData.messages.length - 1].content.substring(0, 50) : "Empty"
            });
            return;
        } catch (err) {
            console.error("Failed to save chat to Redis, falling back to memory:", err);
        }
    }
    
    // In-memory fallback
    memoryStore.set(key, JSON.stringify(messageData));
    if (!memorySets.has('chat_index')) {
        memorySets.set('chat_index', new Set());
    }
    memorySets.get('chat_index')!.add(chatId);
    memoryHashes.set(`chat_meta:${chatId}`, {
        timestamp: new Date().toISOString(),
        preview: messageData.messages ? messageData.messages[messageData.messages.length - 1].content.substring(0, 50) : "Empty"
    });
};

export const getChat = async (chatId: string) => {
    const redis = await getClient();
    const key = `chat:${chatId}`;
    
    if (redis) {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error("Failed to get chat from Redis, falling back to memory:", err);
        }
    }
    
    // In-memory fallback
    const data = memoryStore.get(key);
    return data ? JSON.parse(data) : null;
};

export const listChats = async () => {
    const redis = await getClient();
    
    if (redis) {
        try {
            const chatIds = await redis.sMembers('chat_index');
            const chats = [];
            for (const id of chatIds) {
                const meta = await redis.hGetAll(`chat_meta:${id}`);
                chats.push({
                    id,
                    timestamp: meta.timestamp || null,
                    preview: meta.preview || null
                });
            }
            return chats.sort((a, b) => {
                return (new Date(b.timestamp || 0).getTime()) - (new Date(a.timestamp || 0).getTime());
            });
        } catch (err) {
            console.error("Failed to list chats from Redis, falling back to memory:", err);
        }
    }
    
    // In-memory fallback
    const chatIds = Array.from(memorySets.get('chat_index') || []);
    const chats = [];
    for (const id of chatIds) {
        const meta = memoryHashes.get(`chat_meta:${id}`) || {};
        chats.push({
            id,
            timestamp: meta.timestamp || null,
            preview: meta.preview || null
        });
    }
    return chats.sort((a, b) => {
        return (new Date(b.timestamp || 0).getTime()) - (new Date(a.timestamp || 0).getTime());
    });
};

// --- CV Profile Loader with Redis and Local Fallback ---
export const getCvProfile = async (): Promise<any> => {
    // 1. Try to get cached data from Redis
    const cached = await getCachedData('cv:profile');
    if (cached) {
        return cached;
    }
    
    // 2. Local fallback if Redis is empty or offline
    try {
        const filePath = path.join(process.cwd(), 'src/data/cv-profile.json');
        if (!fs.existsSync(filePath)) {
            throw new Error(`cv-profile.json does not exist at ${filePath}`);
        }
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // 3. Populate Redis cache if online (30 days TTL)
        await cacheData('cv:profile', data, 2592000);
        return data;
    } catch (err: any) {
        console.error("[Redis/FS] Error retrieving CV profile:", err.message || err);
        // Absolute fallback to the basic profile if the detailed one fails
        try {
            const oldPath = path.join(process.cwd(), 'src/data/profile.json');
            if (fs.existsSync(oldPath)) {
                return JSON.parse(fs.readFileSync(oldPath, 'utf8'));
            }
            return null;
        } catch {
            return null;
        }
    }
};

// --- Generic Caching Utils ---
export const cacheData = async (key: string, data: any, ttlSeconds: number) => {
    const redis = await getClient();
    if (redis) {
        try {
            await redis.set(key, JSON.stringify(data), {
                EX: ttlSeconds
            });
            return;
        } catch (error) {
            console.error(`[Redis] Error caching data for ${key}:`, error);
        }
    }
    
    // In-memory fallback
    memoryStore.set(key, JSON.stringify(data));
};

export const getCachedData = async (key: string) => {
    const redis = await getClient();
    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error(`[Redis] Error getting cached data for ${key}:`, error);
        }
    }
    
    // In-memory fallback
    const data = memoryStore.get(key);
    return data ? JSON.parse(data) : null;
};

// --- Short-lived locks (avoid running the same background job twice at once) ---
const memoryLocks = new Map<string, number>();

export const acquireLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
    const redis = await getClient();
    if (redis) {
        try {
            return (await redis.set(key, '1', { NX: true, EX: ttlSeconds })) === 'OK';
        } catch (error) {
            console.error(`[Redis] Error acquiring lock ${key}:`, error);
        }
    }

    const now = Date.now();
    const lockedUntil = memoryLocks.get(key);
    if (lockedUntil && lockedUntil > now) return false;
    memoryLocks.set(key, now + ttlSeconds * 1000);
    return true;
};

export const releaseLock = async (key: string): Promise<void> => {
    memoryLocks.delete(key);
    const redis = await getClient();
    if (!redis) return;
    try {
        await redis.del(key);
    } catch (error) {
        console.error(`[Redis] Error releasing lock ${key}:`, error);
    }
};

// --- View Counter Utils ---
export const getViews = async (slug: string): Promise<number> => {
    const redis = await getClient();
    const key = `views:${slug}`;
    
    if (redis) {
        try {
            const views = await redis.get(key);
            return parseInt(views || '0', 10);
        } catch (error) {
            console.error(`[Redis] Error getting views for ${slug}:`, error);
        }
    }
    
    // In-memory fallback
    const views = memoryStore.get(key);
    return parseInt(views || '0', 10);
};

export const getMultipleViews = async (slugs: string[]): Promise<Record<string, number>> => {
    if (!slugs || slugs.length === 0) return {};
    
    const redis = await getClient();
    if (redis) {
        try {
            const keys = slugs.map(slug => `views:${slug}`);
            const values = await redis.mGet(keys);
            
            const result: Record<string, number> = {};
            slugs.forEach((slug, index) => {
                const val = values[index];
                result[slug] = val ? parseInt(val, 10) : 0;
            });
            return result;
        } catch (error) {
            console.error(`[Redis] Error getting multiple views:`, error);
        }
    }
    
    // In-memory fallback
    const result: Record<string, number> = {};
    slugs.forEach(slug => {
        const val = memoryStore.get(`views:${slug}`);
        result[slug] = val ? parseInt(val, 10) : 0;
    });
    return result;
};

export const incrementView = async (slug: string, userId?: string): Promise<number> => {
    const redis = await getClient();
    const key = `views:${slug}`;
    
    if (redis) {
        try {
            if (userId) {
                const isNewViewer = await redis.sAdd(`viewed:${slug}`, userId);
                if (isNewViewer) {
                    const newCount = await redis.incr(key);
                    return newCount;
                } else {
                    const currentCount = await redis.get(key);
                    return parseInt(currentCount || '0', 10);
                }
            } else {
                const newCount = await redis.incr(key);
                return newCount;
            }
        } catch (error) {
            console.error(`[Redis] Error incrementing views for ${slug}:`, error);
        }
    }
    
    // In-memory fallback
    let currentCount = parseInt(memoryStore.get(key) || '0', 10);
    if (userId) {
        const viewerKey = `viewed:${slug}`;
        if (!memorySets.has(viewerKey)) {
            memorySets.set(viewerKey, new Set());
        }
        const viewers = memorySets.get(viewerKey)!;
        if (!viewers.has(userId)) {
            viewers.add(userId);
            currentCount += 1;
            memoryStore.set(key, currentCount.toString());
        }
    } else {
        currentCount += 1;
        memoryStore.set(key, currentCount.toString());
    }
    return currentCount;
};