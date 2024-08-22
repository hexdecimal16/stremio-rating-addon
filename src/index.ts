import { addonBuilder, Args, ContentType, serveHTTP } from "stremio-addon-sdk-next";
import { handleMetaRequest } from "./handlers/metaHandler";
import { handleCatalogRequest } from "./handlers/catalogHandler";
import manifest from "./manifest";
import dotenv from "dotenv";
import { closeDBClient, getDBClient } from "./repository";
import { closeCacheClient, getCacheClient } from "./cache";
import pg from 'pg';
import { initializeContext } from "./context";

dotenv.config();

initializeContext().then(() => {
    const builder = new addonBuilder(manifest);

    // Catalog Handlers
    builder.defineCatalogHandler(async (args: Args) => {
        console.log("CatalogHandler args:", args);
        await getDBClient();
        try {
            return await handleCatalogRequest(args);
        } catch (error) {
            console.error("Error in CatalogHandler:", error);
            return { metas: [] };
        }
    });

    // Meta Handlers
    builder.defineMetaHandler(async (args: { type: ContentType, id: string }) => {
        await getDBClient();
        try {
            return { meta: await handleMetaRequest(args) };
        } catch (error) {
            console.error("Error in MetaHandler:", error);
            return { meta: {} as any };
        }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        await closeDBClient(); // Close database connection
        await closeCacheClient(); // Close Redis client
        process.exit(0);
    });

    // Additional handlers (stream, subtitle, etc.) can be added similarly
    const port = Number(process.env.PORT) || 3000;
    serveHTTP(builder.getInterface(), { port: port });
    console.log(`🚀 Link for addon http://localhost:${port}`);
}).catch((error) => {
    console.error('Failed to initialize context:', error);
    process.exit(1);
});
