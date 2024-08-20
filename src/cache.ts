import { createClient } from 'redis';

async function createCacheClient() {
    const isCacheEnabled = process.env.CACHE_ENABLED === 'true';
    if (!isCacheEnabled) {
        return null;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = await createClient({ url: redisUrl })
        .on('error', err => console.log('Redis Client Error', err))
        .connect();
    return client;
}


export { createCacheClient };