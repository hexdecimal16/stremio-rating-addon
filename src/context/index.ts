// context.ts
import { RedisClientType } from 'redis';
import { Pool, Client as PgClient } from 'pg';
import { getCacheClient, closeCacheClient } from '../cache';
import { getDBClient, closeDBClient } from '../repository';

export interface AppContext {
    cacheClient: RedisClientType | null;
    dbClient: Pool | PgClient | null;
}

let context: AppContext = {
    cacheClient: null,
    dbClient: null,
};

export async function initializeContext(): Promise<void> {
    context.cacheClient = await getCacheClient();
    context.dbClient = await getDBClient();
}

export function getContext(): AppContext {
    return context;
}

export async function closeContext(): Promise<void> {
    await closeCacheClient();
    await closeDBClient();
}
