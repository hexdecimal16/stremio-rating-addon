import { RedisClientType, createClient } from 'redis';

let cacheClient: RedisClientType | null = null;

export function getCacheClient(): RedisClientType | null {
    if (!cacheClient && process.env.REDIS_URL) {
        console.log('Initializing Redis Cache Client', process.env.REDIS_URL);
        cacheClient = createClient({ url: process.env.REDIS_URL });
        cacheClient.on('error', (err) => console.error('Redis Client Error', err));
        cacheClient.on('connect', () => console.log('Connected to Redis'));
        cacheClient.connect().catch((err) => {
            console.error('Failed to connect to Redis:', err);
            cacheClient = null; // Avoid using an invalid client
        });
    }

    return cacheClient;
}

export async function closeCacheClient(): Promise<void> {
    if (cacheClient) {
        await cacheClient.quit();
        cacheClient = null;
    }
}
