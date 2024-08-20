import { RedisClientType, createClient } from 'redis';

let cacheClient: RedisClientType | null = null;

export async function getCacheClient(): Promise<RedisClientType | null> {
    // If the client is already created, return it
    if (cacheClient) return cacheClient;

    if (!process.env.REDIS_URL) {
        console.warn('Redis URL is not defined. Cache is disabled.');
        return null;
    }

    console.log('Creating Redis Cache Client', process.env.REDIS_URL);
    if (cacheClient) return cacheClient;

    cacheClient = createClient({ url: process.env.REDIS_URL });
    cacheClient.on('error', (err) => console.error('Redis Client Error', err));

    await cacheClient.connect();
    return cacheClient;
}


export async function closeCacheClient(): Promise<void> {
    if (cacheClient) {
        await cacheClient.quit();
        cacheClient = null;
    }
}
