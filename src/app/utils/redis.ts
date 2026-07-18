import { createClient } from 'redis';

// Singleton Redis Client
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let redisConnectionFailed = false;

client.on('error', (err) => {
    console.error('Redis Client Error:', err.message || err);
    redisConnectionFailed = true;
});

const getClient = async () => {
    if (redisConnectionFailed) {
        return null;
    }
    try {
        if (!client.isOpen) {
            // Set a connection timeout of 2 seconds so local development doesn't hang
            const connectPromise = client.connect();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
            );
            await Promise.race([connectPromise, timeoutPromise]);
        }
        return client;
    } catch (err: any) {
        console.warn("Redis offline. Falling back to in-memory mock database.", err.message || err);
        redisConnectionFailed = true;
        return null;
    }
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