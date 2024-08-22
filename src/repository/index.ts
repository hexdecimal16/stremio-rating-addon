import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function getDBClient(): Promise<pg.Pool | null> {
    const connectionStr = process.env.DATABASE_URL;
    if (!connectionStr) {
        console.error('DATABASE_URL is not defined');
        return null;
    }

    if (pool) {
        return pool;
    }

    pool = new Pool({ connectionString: connectionStr, ssl: { rejectUnauthorized: false } });
    pool.on('error', (error) => {
        console.error('Database pool error:', error);
    });

    return pool;
}

export async function closeDBClient(): Promise<void> {
    if (pool) {
        try {
            await pool.end();
        } catch (error) {
            console.error('Error closing database pool:', error);
        } finally {
            pool = null;
        }
    }
}

export async function getRatingsfromTTIDs(ttids: string[]): Promise<Record<string, Record<string, string>>> {
    const pool = await getDBClient();
    if (!pool) {
        throw new Error('Not connected to database');
    }
    try {
        const client = await pool.connect();
        const query = `SELECT ttid, ratings.provider, rating FROM ratings WHERE ttid = ANY($1)`;
        const { rows } = await client.query(query, [ttids]);
        client.release(); // Release client back to pool
        return rows.reduce((acc: Record<string, Record<string, string>>, row: any) => {
            if (!acc[row.ttid]) {
                acc[row.ttid] = {};
            }
            acc[row.ttid][row.provider] = row.rating;
            return acc;
        }, {});
    } catch (error) {
        console.error('Error fetching ratings from database:', error);
        return {};
    }
}

export function isDatabaseConnected(): boolean {
    return pool != null;
}