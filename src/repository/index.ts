import pg from 'pg'
const { Client } = pg

let client: pg.Client | null = null

    ;

export async function getClient(): Promise<pg.Client | null> {
    const connectionStr = process.env.DATABASE_URL
    if (!connectionStr) {
        console.error('DATABASE_URL so not using database')
        return null;
    }
    if (client) {
        console.error('Already connected to database')
        return client
    }
    client = new Client({ connectionString: connectionStr, ssl: { rejectUnauthorized: false } })
    client.on('error', (error) => {
        console.error('Database error:', error)
    });
    client.on('end', () => {
        console.log('Database connection closed')
    });
    client.connect()
}

export async function closeClient() {
    if (client) {
        await client.end()
        client = null
    }
}

export async function getRatingsfromTTIDs(ttids: string[]): Promise<Record<string, Record<string, string>>> {
    if (!client) {
        throw new Error('Not connected to database')
    }
    try {
        const query = `SELECT ttid, ratings.provider, rating FROM ratings WHERE ttid = ANY($1)`
        const { rows } = await client.query(query, [ttids])
        return rows.reduce((acc: Record<string, Record<string, string>>, row: any) => {
            if (!acc[row.ttid]) {
                acc[row.ttid] = {}
            }
            acc[row.ttid][row.provider] = row.rating
            return acc
        }, {});
    } catch (error) {
        console.error('Error fetching ratings from database:', error)
        return {}
    }
}

export function isDatabaseConnected(): boolean {
    return client != null
}